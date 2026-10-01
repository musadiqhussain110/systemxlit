process.env.DATABASE_PATH = ':memory:';
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { connectDatabase, closeDatabase } = require('../src/config/db');
const { env } = require('../src/config/env');
const { User } = require('../src/models/User');
const { Department } = require('../src/models/Department');
const { Lab } = require('../src/models/Lab');
const { Equipment } = require('../src/models/Equipment');
const { Booking } = require('../src/models/Booking');
const { BookingRule } = require('../src/models/BookingRule');
const { EquipmentCategory } = require('../src/models/EquipmentCategory');
const { ActivityLog } = require('../src/models/ActivityLog');
const { createBooking, decideBooking, cancelBooking } = require('../src/services/bookingService');
const { issueBooking, returnBooking } = require('../src/services/issueService');
const { getAnalytics } = require('../src/services/analyticsService');
let checks = 0;
async function check(name, run) { await run(); checks++; console.log('PASS', name); }
async function main() {
 await connectDatabase();
 const department = await Department.create({name:'Computer Science',code:'CS'});
 const otherDepartment = await Department.create({name:'Electrical Engineering',code:'EE'});
 const roles = ['student','faculty','labStaff','coordinator','admin'];
 const actors = {};
 for(const role of roles) actors[role] = await User.create({name:`Test ${role}`,email:`${role}@test.edu`,passwordHash:'test-only',role,department:role === 'admin' ? null : department._id,registrationNumber:role === 'student' ? 'S001' : ''});
 const outsider = await User.create({name:'Other Student',email:'other@test.edu',passwordHash:'test-only',role:'student',department:otherDepartment._id,registrationNumber:'S002'});
 const labData = {name:'Systems Lab',code:'L001',department:department._id,capacity:30,location:'Block A'};
 const lab = await Lab.create(labData);
 const foreignLab = await Lab.create({...labData,name:'Other lab',code:'L002',department:otherDepartment._id});
 const equipmentData = {name:'Arduino Kit',code:'E001',category:'Electronics',department:department._id,lab:lab._id,totalQuantity:12};
 const equipment = await Equipment.create(equipmentData);
 const foreignEquipment = await Equipment.create({...equipmentData,name:'Other kit',code:'E002',department:otherDepartment._id,lab:foreignLab._id});
 await EquipmentCategory.create({name:'Electronics',code:'ELEC'});
 await BookingRule.create({department:department._id,approvalRequired:true,minimumLeadHours:0});
 const day = new Date(); day.setDate(day.getDate()+2);
 const bookingDate = `${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
 const bookingData = {user:actors.student._id,department:department._id,lab:lab._id,bookingDate,startTime:'10:00',endTime:'12:00',purpose:'Academic project test',equipmentItems:[{equipment:equipment._id,quantity:2}]};
 const own = await Booking.create(bookingData);
 const foreignBooking = await Booking.create({...bookingData,user:outsider._id,department:otherDepartment._id,lab:foreignLab._id,equipmentItems:[]});
 await ActivityLog.create({actor:actors.admin._id,action:'test.activity',entityType:'Lab',entityId:lab._id,metadata:{}});
 const { app } = require('../src/app');
 const server = app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
 const base = `http://127.0.0.1:${server.address().port}/api`;
 async function request(role,path,method='GET',body) {
  const user = typeof role === 'string' ? actors[role] : role;
  const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${jwt.sign({sub:user._id,role:'admin'},env.jwtSecret)}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,...await response.json()};
 }
 async function expect(role,path,method,body,status){const result=await request(role,path,method,body);assert.equal(result.status,status,`${role} ${method||'GET'} ${path}: ${result.message}`);return result.data;}
 try {
  // Expected grants are written from the user's table, independently of the policy file.
  const readMatrix=[['/analytics/summary',['coordinator','admin']],['/resources/rules',['coordinator']],['/issues',['labStaff']],['/users',['admin']],['/activity',['admin']],['/resources/equipment',['student','faculty','labStaff']]];
  for(const [path,allowed] of readMatrix) for(const role of roles) await check(`${role} read ${path}`,()=>expect(role,path,'GET',undefined,allowed.includes(role)?200:403));
  for(const role of roles) await check(`${role} approval boundary`,async()=>{
   const booking=await Booking.create({...bookingData,lab:null,equipmentItems:[]});
   await expect(role,`/bookings/${booking._id}/decision`,'PATCH',{decision:'rejected',reason:'Review test'},['labStaff','coordinator'].includes(role)?200:403);
  });
  for(const role of roles) await check(`${role} cancellation boundary`,async()=>{
   const booking=await Booking.create({...bookingData,user:actors[role]._id});
   await expect(role,`/bookings/${booking._id}/cancel`,'PATCH',{},['student','faculty'].includes(role)?200:403);
  });
  for(const role of roles) await check(`${role} priority boundary`,async()=>{
   const booking=await Booking.create({...bookingData,lab:null,equipmentItems:[]});
   await expect(role,`/bookings/${booking._id}/decision`,'PATCH',{decision:'approved',priority:'urgent'},role==='coordinator'?200:403);
  });
  for(const role of roles) await check(`${role} conflict boundary`,()=>expect(role,`/bookings/${own._id}/conflicts`,'GET',undefined,role==='coordinator'?200:403));
  for(const role of roles) await check(`${role} lab management boundary`,async()=>{
   const created=await expect(role,'/resources/labs','POST',{...labData,code:`CREATE-${role}`},['coordinator','admin'].includes(role)?201:403);
   await expect(role,`/resources/labs/${lab._id}`,'PUT',{name:'Renamed lab'},['coordinator','admin'].includes(role)?200:403);
   await expect(role,`/resources/labs/${lab._id}`,'PUT',{status:'available',availableSlots:[]},['labStaff','coordinator','admin'].includes(role)?200:403);
   const disposable=await Lab.create({...labData,code:`DELETE-${role}`});
   await expect(role,`/resources/labs/${disposable._id}`,'DELETE',undefined,['coordinator','admin'].includes(role)?200:403);
  });
  for(const role of roles) await check(`${role} equipment management boundary`,async()=>{
   await expect(role,'/resources/equipment','POST',{...equipmentData,code:`CREATE-${role}`},role==='labStaff'?201:403);
   await expect(role,`/resources/equipment/${equipment._id}`,'PUT',{maintenanceStatus:'operational'},role==='labStaff'?200:403);
   const disposable=await Equipment.create({...equipmentData,code:`DELETE-${role}`});
   await expect(role,`/resources/equipment/${disposable._id}`,'DELETE',undefined,role==='labStaff'?200:403);
  });
  for(const role of roles) await check(`${role} issue/return boundary`,async()=>{
   const booking=await Booking.create({...bookingData,lab:null,approvalStatus:'approved',status:'reserved',equipmentItems:[]});
   await expect(role,`/issues/${booking._id}/issue`,'POST',{},role==='labStaff'?201:403);
   await expect(role,`/issues/${booking._id}/return`,'PATCH',{items:[]},role==='labStaff'?200:403);
  });
  for(const role of roles) await check(`${role} booking-rule boundary`,()=>expect(role,'/resources/rules','PUT',{department:department._id,maxDurationMinutes:180},role==='coordinator'?200:403));
  for(const resource of ['departments','categories']) for(const role of roles) await check(`${role} ${resource} management boundary`,async()=>{
   const created=await expect(role,`/resources/${resource}`,'POST',{name:`${resource} ${role}`,code:`${resource}-${role}`},role==='admin'?201:403);
   // Denied writes use real existing records as targets rather than relying on a 404.
   const existing=resource==='departments'?department:await EquipmentCategory.findOne({code:'ELEC'});
   await expect(role,`/resources/${resource}/${role==='admin'?created._id:existing._id}`,'PUT',{name:`Updated ${resource} ${role}`},role==='admin'?200:403);
   await expect(role,`/resources/${resource}/${role==='admin'?created._id:existing._id}`,'DELETE',undefined,role==='admin'?200:403);
  });
  await check('Administrator can assign exactly the defined roles',async()=>{
   for(const role of roles){const created=await expect('admin','/users','POST',{name:`Assigned ${role}`,email:`assigned-${role}@test.edu`,password:'StrongPassword1!',role,department:role==='admin'?null:department._id,registrationNumber:role==='student'?'ASSIGNED001':''},201);assert.equal(created.role,role);}
   await expect('admin','/users','POST',{name:'Unsupported role',email:'unknown@test.edu',password:'StrongPassword1!',role:'superadmin',department:department._id},400);
   await expect('admin',`/users/${actors.faculty._id}`,'PUT',{role:'superadmin'},400);
   await expect('admin',`/users/${actors.faculty._id}`,'PUT',{permissions:['issues.manage']},400);
   await expect('admin',`/users/${actors.faculty._id}`,'PUT',{department:null},400);
  });
  for(const role of roles.filter(role=>role!=='admin')) await check(`${role} cannot change account permissions`,()=>expect(role,`/users/${actors[role]._id}`,'PUT',{role:'admin'},403));
  for(const role of ['admin','labStaff','coordinator']) await check(`Public registration cannot assign ${role}`,async()=>{const response=await fetch(base+'/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Privilege attempt',email:`register-${role}@test.edu`,password:'StrongPassword1!',role,department:department._id})});assert.equal(response.status,400)});
  await check('Student/faculty see and cancel only their own bookings',async()=>{
   for(const role of ['student','faculty']) { const rows=await expect(role,`/bookings?user=${outsider._id}`,'GET',undefined,200);assert.ok(rows.every(row=>row.user._id===actors[role]._id));await expect(role,`/bookings/${foreignBooking._id}/cancel`,'PATCH',{},403); }
  });
  await check('Department roles see only their assigned department records',async()=>{
   for(const role of ['labStaff','coordinator']) {
    const labs=await expect(role,'/resources/labs','GET',undefined,200);assert.ok(labs.every(row=>row.department._id===department._id));
    const bookings=await expect(role,'/bookings','GET',undefined,200);assert.ok(bookings.every(row=>row.department._id===department._id));
    await expect(role,`/resources/labs?department=${otherDepartment._id}`,'GET',undefined,403);
    await expect(role,`/resources/labs/${foreignLab._id}`,'PUT',{status:'closed'},403);
    await expect(role,`/bookings/${foreignBooking._id}/decision`,'PATCH',{decision:'rejected'},403);
   }
   const items=await expect('labStaff','/resources/equipment','GET',undefined,200);assert.ok(items.every(row=>row.department._id===department._id));
   await expect('labStaff',`/resources/equipment/${foreignEquipment._id}`,'PUT',{maintenanceStatus:'maintenance'},403);
   await expect('labStaff','/resources/equipment','POST',{...equipmentData,code:'CROSS-LAB',lab:foreignLab._id},403);
   await expect('labStaff',`/issues/${foreignBooking._id}/issue`,'POST',{},403);
   await expect('labStaff',`/issues/${foreignBooking._id}/return`,'PATCH',{},403);
   await expect('coordinator',`/bookings/${foreignBooking._id}/conflicts`,'GET',undefined,403);
   await expect('coordinator','/resources/rules','PUT',{department:otherDepartment._id},403);
   await expect('coordinator','/resources/rules','PUT',{department:null},403);
  });
  await check('Lab staff cannot modify lab identity/capacity through mixed payloads',()=>expect('labStaff',`/resources/labs/${lab._id}`,'PUT',{status:'available',capacity:999,department:department._id},403));
  await check('Department roles without assignments fail closed',async()=>{
   for(const role of ['labStaff','coordinator']) {
    const user=await User.create({name:'Unassigned',email:`unassigned-${role}@test.edu`,passwordHash:'test-only',role,department:null});
    await expect(user,'/bookings','GET',undefined,403);await expect(user,'/resources/labs','GET',undefined,403);
    await expect(user,role==='coordinator'?'/analytics/summary':'/issues','GET',undefined,403);
   }
  });
  await check('Assigned departments and resource history cannot be deleted',async()=>{await expect('admin',`/resources/departments/${department._id}`,'DELETE',undefined,409);await expect('coordinator',`/resources/labs/${lab._id}`,'DELETE',undefined,409);await expect('labStaff',`/resources/equipment/${equipment._id}`,'DELETE',undefined,409);});
  await check('Admin monitoring remains system-wide and read-only for bookings',async()=>{const rows=await expect('admin','/bookings','GET',undefined,200);assert.ok(rows.some(row=>row._id===foreignBooking._id));const history=await expect('admin','/activity','GET',undefined,200);assert.ok(history.every(row=>row.entityType==='Booking'));await expect('admin',`/bookings/${own._id}/decision`,'PATCH',{decision:'approved'},403);});
  await check('JWT role claims cannot override current account permissions',()=>expect('student','/users','GET',undefined,403));
  await check('Disabled accounts and unsupported roles cannot use the API',async()=>{
   const user=await User.create({name:'Disabled',email:'disabled@test.edu',passwordHash:'test-only',role:'admin',active:false});await expect(user,'/users','GET',undefined,401);
   const unknown=await User.create({name:'Unknown',email:'invalid@test.edu',passwordHash:'test-only',role:'superadmin'});await expect(unknown,'/bookings','GET',undefined,403);
  });
  await check('Coordinator conflict handling returns available alternatives',async()=>{
   await Booking.create({...bookingData,status:'reserved',approvalStatus:'approved'});
   const result=await expect('coordinator',`/bookings/${own._id}/conflicts`,'GET',undefined,200);
   assert.equal(result.availability.available,false);assert.equal(result.availability.labConflict,true);assert.ok(result.suggestions.length>0);assert.ok(result.suggestions.every(slot=>slot.startTime>='12:00'));
  });
  await check('Service calls also enforce exact operational roles',async()=>{
   for(const role of ['admin','student','faculty']) await assert.rejects(decideBooking(actors[role],own._id,'approved'),err=>err.statusCode===403);
   for(const role of ['admin','student','faculty','coordinator']) {await assert.rejects(issueBooking(actors[role],own._id),err=>err.statusCode===403);await assert.rejects(returnBooking(actors[role],own._id),err=>err.statusCode===403);}
   for(const role of ['admin','labStaff','coordinator']) await assert.rejects(cancelBooking(actors[role],own._id),err=>err.statusCode===403);
   for(const role of ['student','faculty','labStaff']) await assert.rejects(getAnalytics(actors[role]),err=>err.statusCode===403);
  });
  console.log(`ROLE MATRIX: ${checks} checks passed. Saved database untouched.`);
 } finally {await new Promise(resolve=>server.close(resolve));await closeDatabase();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
