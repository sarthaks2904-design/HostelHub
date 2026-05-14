# HostelHub

## Problem Statement
Managing hostel operations manually leads to inefficient record handling, delayed communication, poor attendance tracking, security risks, and lack of transparency in fee and complaint management. Existing solutions are often fragmented, outdated, or lack real-time monitoring.

HostelHub solves these issues through a centralized, role-based hostel management system with real-time monitoring, student services, complaint handling, fee tracking, and security-focused movement management.

---

# Team Details

- Team Name: [CodeSays]
- Team Leader: Sarthak Sarode
- Category: Web Application / Smart Management System
- Hackathon Name: [HostelHub]

---

# Project Overview

HostelHub is a hostel management web application designed to streamline hostel administration, improve student safety, and automate daily hostel operations.

The system provides dedicated dashboards for administrators, wardens, and students with secure authentication, real-time communication, movement tracking, complaint management, fee verification, and hostel analytics.

---

# Key Features

## Authentication & Security
- JWT-based authentication
- Password hashing using bcrypt
- Role-based access control
- Protected routes
- Secure session handling

## Role Management
- ADMIN
- Male Warden
- Female Warden
- STUDENT

## Student Management
- Student registration system
- Academic and hostel details management
- Parent and emergency contact storage
- Student profile dashboard

## Fee Management
- Fee payment tracking
- Receipt image upload
- Admin verification system
- Fine management
- Payment timeline history
- Pending and cleared status tracking

## Hostel Movement & Security
- Entry/exit request system
- Curfew violation tracking
- Overdue alerts
- SOS emergency feature

## Complaint Management
- Complaint submission system
- Anti-ragging complaint section
- Complaint status tracking

## Real-Time Features
- Socket.IO real-time notifications
- Instant movement updates
- Fee status notifications
- SOS alerts
- Attendance updates

## Additional Features
- Mess management
- Meal ratings
- Leave requests
- Attendance tracking
- Analytics dashboard

---

# Tech Stack

## Frontend
- HTML
- CSS
- JavaScript

## Backend
- Node.js
- Express.js
- Socket.IO

## Authentication & Security
- JWT Authentication
- bcrypt Password Hashing

## Database / Storage
- JSON File-Based Storage

---

# System Architecture

```text
User (Admin / Warden / Student)
            ↓
      Frontend Interface
            ↓
        Express Server
            ↓
 Authentication & APIs
            ↓
 JSON Storage + Socket.IO
```

---

# Project Workflow

1. User logs into the system.
2. Role-based dashboard is assigned.
3. Students can manage fees, complaints, attendance, and hostel movement.
4. Wardens monitor hostel activity and approvals.
5. Admin controls records, fee verification, and analytics.
6. Real-time updates are delivered using Socket.IO.

---

# Installation & Setup

## Clone Repository

```bash
git clone https://github.com/sarthaks2904-design/hostel-management-system.git
```

## Navigate to Project Folder

```bash
cd hostel-management-system
```

## Install Dependencies

```bash
npm install
```

## Start Application

```bash
npm start
```

Application runs on:

```text
http://localhost:3000
```

---

# Default Credentials

| Role | Username | Password |
|---|---|---|
| Admin | admin | Admin@123 |
| Male Warden | warden | Warden@123 |
| Female Warden | warden-girls | Warden@123 |
| Student | 24014001030 | sarthak123 |

---

# Future Scope

- Database integration using MongoDB
- AI-based attendance monitoring
- Face recognition for hostel entry
- Mobile application support
- Cloud deployment
- Advanced analytics and reporting
- Biometric integration

---

# Innovation & Impact

HostelHub improves hostel administration by reducing manual workload, increasing operational transparency, improving student safety, and enabling real-time monitoring and communication.

The project is scalable and can be adapted for schools, colleges, PG hostels, and residential institutions.

---

# Challenges Solved

- Manual hostel record management
- Delayed communication
- Lack of real-time monitoring
- Poor fee tracking systems
- Inefficient complaint handling
- Security and movement tracking issues

---

# Demo & Presentation Requirements

## Recommended Additions
- Project screenshots
- System architecture diagram
- Demo video link
- GitHub repository link
- Deployment link

---

# Conclusion

HostelHub is a smart hostel management solution focused on automation, security, transparency, and operational efficiency. The platform combines modern authentication, real-time communication, and centralized management into a single scalable system suitable for educational institutions.
