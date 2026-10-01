from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from pathlib import Path
from pypdf import PdfReader
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleCustom',fontName='Helvetica-Bold',fontSize=29,leading=34,textColor=colors.HexColor('#382343'),spaceAfter=18))
styles.add(ParagraphStyle(name='SectionCustom',fontName='Helvetica-Bold',fontSize=14,leading=19,textColor=colors.HexColor('#624276'),spaceBefore=15,spaceAfter=8))
styles.add(ParagraphStyle(name='BodyCustom',fontName='Helvetica',fontSize=10,leading=16,textColor=colors.HexColor('#51485a'),spaceAfter=9))
styles.add(ParagraphStyle(name='KickerCustom',fontName='Helvetica-Bold',fontSize=9,leading=13,textColor=colors.HexColor('#766280'),spaceAfter=13))
story=[]
def p(text,style='BodyCustom'):story.append(Paragraph(text,styles[style]))
def section(title,text):p(title,'SectionCustom');p(text)
def footer(c,d):
 c.setStrokeColor(colors.HexColor('#e3dce9'));c.line(48,44,547,44);c.setFont('Helvetica',8);c.setFillColor(colors.HexColor('#82738d'));c.drawString(48,30,'SYSTEM X 1.0  /  University Lab & Equipment Booking');c.drawRightString(547,30,str(d.page))
p('PROJECT EXPLANATION  /  01 OCTOBER 2026','KickerCustom');p('Campus resources,<br/>connected.','TitleCustom')
p('University Lab &amp; Equipment Booking System','SectionCustom')
p('A web application that connects resource discovery, university booking rules, staff approval, equipment handover, return tracking, and usage analytics.')
section('The problem','Shared laboratories and equipment are difficult to coordinate through paper forms and messages. This system gives students, faculty, and staff a common record of availability, ownership, approval, and return condition.')
section('The complete journey','Discover resources → choose a department, date and time → check capacity, rules and availability → submit a request → staff approval or automatic reservation → issue resources → record the return → update analytics and history.'.replace('→','&gt;'))
section('Who uses it','<b>Students and faculty:</b> discover resources, request bookings, track outcomes, cancel eligible requests, and receive notifications.<br/><b>Lab staff:</b> review department requests, manage resource status, issue equipment, and record returns.<br/><b>Coordinators:</b> manage department resources, booking rules, priorities, and analytics.<br/><b>Administrators:</b> manage users, permissions, departments, categories, university resources, rules, and activity history.')
section('Implementation','React 19 and React Router power the Vite frontend. Express handles the API. SQLite is accessed through Node.js node:sqlite and repository modules. JWT, bcrypt, Zod, Helmet, rate limits, and server-side role checks protect the workflow. A scheduled job creates in-app reminders.')
story.append(PageBreak())
p('STRUCTURE  /  HOW THE PARTS CONNECT','KickerCustom');p('A clear separation<br/>of responsibilities.','TitleCustom')
rows=[['Location','Purpose'],['client/src/pages','Public home, authentication, dashboard, resource discovery, booking, operations, analytics, notifications, and administration screens.'],['client/src/components','Shared branding, page headings, status badges, cards, loading states, and keyboard-accessible dialogs.'],['client/src/context + api','Authentication state and the HTTP client that sends authenticated API requests.'],['client/src/styles/global.css','Responsive design, Manrope headings, DM Sans body type, and the plum / white / lime visual palette.'],['server/src/routes + controllers','HTTP endpoints, permission checks, validation entry points, and responses.'],['server/src/services','Booking, conflict detection, rules, recommendations, equipment handover, notifications, and analytics.'],['server/src/models + db','SQLite repository wrappers and shared database access.'],['server/src/config','Database schema, migrations, and environment configuration.'],['server/src/jobs','Booking reminders, return reminders, and overdue status updates.'],['server/tests/workflow.cjs','Isolated in-memory regression tests; the saved application database is untouched.']]
t=Table([[Paragraph(c,styles['BodyCustom']) for c in row] for row in rows],colWidths=[167,332]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eee8f3')),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#e5dfe9')),('LEFTPADDING',(0,0),(-1,-1),8),('RIGHTPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),3)]));story.append(t)
story.append(PageBreak())
p('WORKFLOW  /  VERIFICATION & DELIVERY','KickerCustom');p('Designed to keep<br/>every step accountable.','TitleCustom')
section('Booking and intelligent recommendations','bookingService checks the requested department, participant capacity, rules, and resource availability. availabilityService checks overlapping reservations and equipment quantities. recommendationService scores available labs by department, capacity, facilities/purpose, and equipment sufficiency. Conflicts return later available time windows where possible.')
section('Issue, return, and maintenance','issueService creates a dated handover record, checks physical stock, and records the return time and condition. Late returns can trigger an account restriction. Damaged or missing equipment is conservatively blocked for inspection until staff restore its maintenance state. Activity logs preserve decisions and resource changes.')
section('Verification completed','16 in-memory integration checks cover capacity, department restrictions, duplicate requests, concurrent approval and automatic reservation conflicts, recommendations, alternatives, issue state, overdue cancellation, damaged returns, notifications, analytics, cancelled-request approval, and invalid time windows. Browser smoke checks cover the administration pages and key mobile pages; these checks are not a complete security audit.')
section('Run locally','Install Node.js 22.5 or newer and project dependencies. Configure server/.env and client/.env using the examples. Run npm run dev. The frontend defaults to port 5173 and the API to port 5000. SQLite initializes automatically. The one-time setup screen creates the first administrator. Optional npm run seed resets the database and must only be used for disposable demo data.')
section('Deployment and submission','Run one API process with persistent SQLite storage and a strong JWT secret. Configure HTTPS, client origin, backups, frontend history fallback, and VITE_API_URL for the deployed API. Multiple API workers require database-level locking; the current reservation queue protects one process. The separate demonstration video and GitHub or deployed application link still need to be prepared for submission.')
path=Path('output/pdf/Project_Explanation.pdf')
SimpleDocTemplate(str(path),pagesize=(595,842),rightMargin=48,leftMargin=48,topMargin=48,bottomMargin=60,title='University Lab & Equipment Booking System - Project Explanation',author='System X 1.0').build(story,onFirstPage=footer,onLaterPages=footer)
print('PDF pages:', len(PdfReader(path).pages))
