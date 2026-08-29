"""Seeds the vector store with one sample policy document per knowledge category."""

from datetime import datetime, timezone

from vector_store import generate_fallback_embedding, global_vector_db


def _make_doc(doc_id: str, name: str, category: str, upload_date: str, chunks_text: list[tuple[int, str]]) -> tuple[dict, list[dict]]:
    """Builds a document meta record and its chunk records from (page_number, text) tuples."""
    chunks = []
    for idx, (page_number, text) in enumerate(chunks_text):
        chunks.append(
            {
                "id": f"chunk_{doc_id}_{idx}",
                "docId": doc_id,
                "docName": name,
                "chunkIndex": idx,
                "pageNumber": page_number,
                "charLength": len(text),
                "tokenEstimate": max(1, len(text) // 4),
                "text": text,
                "embedding": generate_fallback_embedding(text),
            }
        )

    doc = {
        "id": doc_id,
        "name": name,
        "category": category,
        "sizeBytes": sum(c["charLength"] for c in chunks),
        "uploadDate": upload_date,
        "pageCount": max((c["pageNumber"] for c in chunks), default=1),
        "chunkCount": len(chunks),
        "totalTokensEstimate": sum(c["tokenEstimate"] for c in chunks),
        "vectorDimensions": 768,
        "status": "ready",
    }
    return doc, chunks


def populate_sample_docs_if_empty() -> None:
    existing = global_vector_db.get_documents()
    if len(existing) > 0:
        return

    print("Initializing sample IT company knowledge base documents into RAG Vector Store...")

    upload_date = datetime.now(timezone.utc).isoformat()

    docs = [
        _make_doc(
            "doc_sample_hr_policy",
            "HR_Policy_Handbook.pdf",
            "HR Policy",
            upload_date,
            [
                (1, "This HR Policy Handbook applies to all full-time, part-time, and contract employees of the company. "
                    "It establishes the standards of conduct, benefits, and responsibilities that govern the employment "
                    "relationship. Employees are expected to read and acknowledge this handbook within their first week "
                    "of joining."),
                (1, "Working Hours: Standard working hours are 9:00 AM to 6:00 PM, Monday through Friday, with a one-hour "
                    "lunch break. Flexible working arrangements may be approved by an employee's reporting manager on a "
                    "case-by-case basis, provided core collaboration hours of 11:00 AM to 4:00 PM are maintained."),
                (2, "Performance Reviews: Formal performance appraisals are conducted twice a year, in April and October. "
                    "Reviews assess goal completion, competency development, and behavioral alignment with company values. "
                    "Ratings directly influence annual merit increases and promotion eligibility."),
                (2, "Code of Conduct & Grievance Redressal: Employees who experience or witness workplace harassment, "
                    "discrimination, or policy violations should report the issue to HR via the confidential grievance "
                    "portal. All complaints are investigated within 10 business days and outcomes are communicated in "
                    "writing to the complainant."),
                (3, "Termination & Notice Period: Employees are required to serve a notice period of 60 days for "
                    "resignation, or as specified in their offer letter. The company reserves the right to provide "
                    "pay-in-lieu of notice. Full and final settlement is processed within 45 days of the last working day."),
            ],
        ),
        _make_doc(
            "doc_sample_leave_policy",
            "Leave_and_Attendance_Policy.pdf",
            "Leave Policy",
            upload_date,
            [
                (1, "Leave Entitlement: Employees are entitled to 18 days of Paid Time Off (PTO), 12 days of Sick Leave, "
                    "and 10 public holidays per calendar year. Leave accrues monthly at a rate of 1.5 days of PTO. Unused "
                    "PTO up to 10 days may be carried forward to the next calendar year."),
                (1, "Applying for Leave: All leave requests must be submitted through the HR portal at least 3 working "
                    "days in advance, except in cases of medical emergency. Leave requests are auto-escalated to the "
                    "reporting manager for approval and must be approved before the leave start date."),
                (2, "Maternity & Paternity Leave: Female employees are entitled to 26 weeks of paid maternity leave in "
                    "accordance with statutory requirements. Paternity leave of 2 weeks is granted to male employees "
                    "within 3 months of the child's birth or adoption."),
                (2, "Sick Leave & Medical Certification: Sick leave exceeding 2 consecutive days requires a medical "
                    "certificate submitted to HR within 3 working days of return. Unauthorized absence beyond 3 "
                    "consecutive days without notice may be treated as job abandonment."),
                (3, "Leave Without Pay (LWP): Employees who exhaust their leave balance may request Leave Without Pay, "
                    "subject to manager and HR approval. LWP exceeding 30 days in a calendar year requires Director-level "
                    "sign-off and may affect increment eligibility."),
            ],
        ),
        _make_doc(
            "doc_sample_it_security_policy",
            "IT_Security_and_Acceptable_Use_Policy.pdf",
            "IT Security Policy",
            upload_date,
            [
                (1, "Purpose & Scope: This IT Security Policy defines the minimum security standards for all employees, "
                    "contractors, and third parties accessing company systems, networks, and data. Non-compliance may "
                    "result in disciplinary action, including termination of access or employment."),
                (1, "Password & Authentication: All company accounts must use passwords with a minimum of 12 characters, "
                    "including uppercase, lowercase, numbers, and symbols. Multi-Factor Authentication (MFA) is mandatory "
                    "for VPN, email, and all cloud administration consoles. Passwords must be rotated every 90 days."),
                (2, "Data Classification & Handling: Company data is classified as Public, Internal, Confidential, or "
                    "Restricted. Confidential and Restricted data must be encrypted at rest (AES-256) and in transit "
                    "(TLS 1.2+), and must never be stored on personal devices or unsanctioned cloud storage services."),
                (2, "Acceptable Use: Company-issued laptops and accounts are provided for business use. Installation of "
                    "unauthorized software, disabling of endpoint antivirus/EDR agents, or connecting to untrusted "
                    "public Wi-Fi without VPN is strictly prohibited."),
                (3, "Incident Reporting: Any suspected phishing email, malware infection, lost device, or data breach "
                    "must be reported to the Security Operations Center (SOC) within 1 hour of discovery via "
                    "security@company.com or the internal incident hotline. Delayed reporting may compound breach impact."),
            ],
        ),
        _make_doc(
            "doc_sample_code_of_conduct",
            "Code_of_Conduct.pdf",
            "Code of Conduct",
            upload_date,
            [
                (1, "Our Code of Conduct sets out the ethical and professional standards expected of every employee. "
                    "It covers integrity, respect, confidentiality, and compliance with applicable laws in every "
                    "jurisdiction where the company operates."),
                (1, "Anti-Harassment & Non-Discrimination: The company maintains a zero-tolerance policy toward "
                    "harassment, bullying, or discrimination based on race, gender, religion, disability, age, or "
                    "sexual orientation. All employees complete mandatory anti-harassment training annually."),
                (2, "Conflict of Interest: Employees must disclose any personal, financial, or familial relationships "
                    "that could reasonably be seen to influence business decisions, including vendor selection, "
                    "hiring, or procurement. Disclosures are reviewed by the Ethics Committee."),
                (2, "Confidentiality & Intellectual Property: All work product, source code, designs, and client data "
                    "created during employment are the exclusive property of the company. Employees must not disclose "
                    "confidential information during or after employment without written authorization."),
                (3, "Gifts & Anti-Bribery: Employees may not accept gifts, hospitality, or kickbacks exceeding $75 in "
                    "value from vendors, clients, or partners without prior disclosure to their manager and Compliance."),
            ],
        ),
        _make_doc(
            "doc_sample_expense_policy",
            "Expense_and_Travel_Policy.pdf",
            "Expense & Travel Policy",
            upload_date,
            [
                (1, "This policy governs the reimbursement of business-related travel and expenses. All expenses must "
                    "be pre-approved by the reporting manager where the estimated cost exceeds $500, and submitted "
                    "through the Expense Management System within 15 days of being incurred."),
                (1, "Travel Booking: Domestic flights must be booked in economy class; business class is permitted "
                    "only for flights exceeding 6 hours with Director-level approval. Hotel bookings should not "
                    "exceed the per-city rate cap published on the internal Travel Portal."),
                (2, "Meals & Per Diem: Employees on domestic business travel are entitled to a per diem of $60/day "
                    "for meals and incidentals. Itemized receipts are required for any single expense exceeding $25."),
                (2, "Client Entertainment: Client meals and entertainment expenses require the client name, business "
                    "purpose, and attendee list to be logged. Alcohol expenses are reimbursable up to a $100 cap per "
                    "event and must comply with local regulations."),
                (3, "Non-Reimbursable Items: Personal entertainment, traffic or parking fines, spa services, and "
                    "expenses lacking valid receipts will not be reimbursed. Fraudulent expense claims are grounds "
                    "for immediate termination."),
            ],
        ),
        _make_doc(
            "doc_sample_onboarding_guide",
            "Employee_Onboarding_Guide.pdf",
            "Onboarding Guide",
            upload_date,
            [
                (1, "Welcome to the company! This Onboarding Guide walks new hires through their first 30 days, "
                    "covering account provisioning, mandatory training, team introductions, and key policies every "
                    "employee should know."),
                (1, "Day 1 Checklist: Collect your company laptop and badge from IT Helpdesk, complete identity "
                    "verification, set up your corporate email and MFA, and join the '#new-joiners' Slack channel "
                    "for onboarding announcements."),
                (2, "Mandatory Training: All new hires must complete Information Security Awareness, Anti-Harassment, "
                    "and Code of Conduct training modules within the first 2 weeks via the Learning Management System "
                    "(LMS). Completion is tracked by HR and required before probation review."),
                (2, "Probation Period: New employees undergo a 90-day probation period during which performance and "
                    "cultural fit are assessed by the reporting manager. A formal check-in occurs at day 30, day 60, "
                    "and day 90 with documented feedback."),
                (3, "Key Contacts: For payroll and benefits questions, contact hr@company.com. For laptop, VPN, or "
                    "account issues, contact it-helpdesk@company.com. For expense or travel bookings, use the Finance "
                    "Portal linked on the intranet homepage."),
            ],
        ),
    ]
    for doc_meta, doc_chunks in docs:
        global_vector_db.add_document(doc_meta, doc_chunks)

    print(f"Seeded {len(docs)} sample IT knowledge base documents across categories.")
