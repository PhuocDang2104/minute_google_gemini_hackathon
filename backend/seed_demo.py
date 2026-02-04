import sys
import os
from datetime import datetime, timedelta
import uuid

# Add current dir to path to allow importing app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.db.session import SessionLocal
from app.models.user import UserAccount, Organization, Project, Department
from app.models.meeting import Meeting, MeetingParticipant
from app.models.adr import TranscriptChunk, ActionItem, DecisionItem, RiskItem

def seed_data():
    db = SessionLocal()
    try:
        print("Seeding demo data...")

        # 1. Create Organization
        org = db.query(Organization).filter(Organization.name == "VNPT Group").first()
        if not org:
            org = Organization(id=uuid.uuid4(), name="VNPT Group")
            db.add(org)
            db.commit()
            print("Created Organization: VNPT Group")

        # 2. Create Project ORION
        project = db.query(Project).filter(Project.name == "ORION").first()
        if not project:
            project = Project(
                id=uuid.uuid4(),
                organization_id=org.id,
                name="ORION",
                code="ORION-01",
                description="Dự án chuyển đổi số quy mô lớn"
            )
            db.add(project)
            db.commit()
            print("Created Project: ORION")

        # 3. Create Users
        users_data = [
            {"email": "quan.chair@vnpt.vn", "name": "Ông Quân", "role": "chair"},
            {"email": "dat.it@vnpt.vn", "name": "Ông Đạt", "role": "director"},
            {"email": "phuoc.risk@vnpt.vn", "name": "Ông Phước", "role": "risk_manager"},
        ]
        
        users_map = {}
        for u in users_data:
            user = db.query(UserAccount).filter(UserAccount.email == u["email"]).first()
            if not user:
                user = UserAccount(
                    id=uuid.uuid4(),
                    email=u["email"],
                    display_name=u["name"],
                    organization_id=org.id,
                    role=u['role']
                )
                db.add(user)
                db.commit()
                print(f"Created User: {u['name']}")
            users_map[u["name"]] = user

        # 4. Create Meeting
        meeting_title = "HỌP HỘI ĐỒNG QUẢN TRỊ DỰ ÁN ORION GIAI ĐOẠN 1"
        meeting_desc = "Trình và quyết nghị các nội dung giai đoạn 1 của ORION: trần ngân sách, phương án đưa dự toán về đúng trần, điều kiện tuân thủ bắt buộc và cơ chế giám sát/báo cáo."
        
        # Check if meeting exists
        existing_meeting = db.query(Meeting).filter(Meeting.title == meeting_title).first()
        if existing_meeting:
            print("Meeting already exists. Skipping creation.")
            # Optionally delete it to re-seed? Let's just return to avoid duplicating logic heavily or assuming
            # For demo reset, maybe we should delete it?
            # Let's delete it to be fresh
            print("Deleting existing meeting to re-seed...")
            
            # Delete related data first (though verifycascade should handle it, safer to be explicit if needed, but CASCADE is ON)
            db.delete(existing_meeting)
            db.commit()

        start_time = datetime(2025, 12, 1, 9, 0, 0)
        end_time = datetime(2025, 12, 1, 11, 30, 0)

        meeting = Meeting(
            id=uuid.uuid4(),
            title=meeting_title,
            description=meeting_desc,
            organizer_id=users_map["Ông Quân"].id,
            project_id=project.id,
            start_time=start_time,
            end_time=end_time,
            meeting_type="STEERING COMMITTEE",
            location="MICROSOFT TEAMS",
            teams_link="https://teams.live.com/meet/9392620868227?p=RV8qxyF5TgYYK4joIk",
            phase="post" # Set to post so it shows in Post-Meet tab
        )
        db.add(meeting)
        db.commit()
        print(f"Created Meeting: {meeting_title}")

        # 5. Participants
        for name, user in users_map.items():
            part = MeetingParticipant(
                meeting_id=meeting.id,
                user_id=user.id,
                role="organizer" if name == "Ông Quân" else "attendee",
                response_status="accepted",
                attended=True
            )
            db.add(part)
        db.commit()

        # 6. Transcript
        transcript_text = [
            ("Ông Quân", "Ok, mình khai mạc phiên họp Hội đồng quản trị về dự án ORION giai đoạn 1 nhé. Chương trình họp gồm 3 mục: một là Ban Điều hành trình bày tổng quan ngân sách giai đoạn 1; hai là báo cáo rủi ro trọng yếu và điều kiện tuân thủ trước triển khai; ba là Hội đồng quản trị biểu quyết thông qua nghị quyết và giao nhiệm vụ triển khai. Mời anh Đạt trình bày trước."),
            ("Ông Đạt", "Ok, em chuyển sang phần ngân sách để Hội đồng quản trị nắm bức tranh tổng quan nhé. Tổng dự toán hiện tại là 45,43 tỷ đồng. Nhóm dự án đã chuẩn bị phương án xử lý chênh lệch theo tài liệu chung về xử lý vượt trần. Cụ thể, đề xuất kết hợp 3 phương án với Tổng giảm 0,60 tỷ, đưa dự toán về 44,83 tỷ, thấp hơn trần và không ảnh hưởng các hạng mục tuân thủ bắt buộc."),
            ("Ông Phước", "Ok, tôi chuyển sang phần rủi ro và điều kiện tuân thủ để Hội đồng quản trị quyết nghị kèm điều kiện triển khai nhé. Có 2 rủi ro mức độ đỏ cần điều kiện bắt buộc."),
            ("Ông Phước", "Rủi ro đầu tiên là công ty có rủi ro đáng báo động là vượt trần ngân sách 45,0 tỷ nếu không cập nhật dự toán kịp thời. Rủi ro này có thể làm chậm phê duyệt và dừng triển khai."),
            ("Ông Phước", "Rủi ro thứ hai là chưa đóng đủ các kiến nghị mức độ cao về kiểm soát truy cập, nhật ký giám sát và dữ liệu nhạy cảm. Điều kiện đề xuất là: chỉ được cấp dữ liệu thử nghiệm và triển khai vận hành thử khi đã nộp đủ minh chứng EVD-001 đến EVD-003 theo bảng theo dõi. Tôi đề nghị Hội đồng quản trị đưa các điều kiện này vào nghị quyết để làm cơ sở giám sát và báo cáo định kỳ."),
            ("Ông Quân", "Ok, tôi chuyển sang phần biểu quyết và giao nhiệm vụ nhé. Hội đồng quản trị ghi nhận tổng dự toán hiện tại 45,43 tỷ và thống nhất cần đưa dự toán về không vượt trần 45,0 tỷ trước ngày 15/01/2026."),
            ("Ông Quân", "Vậy chúng ta quyết định rằng: Hội đồng quản trị thông qua Nghị quyết 1 - phê duyệt trần ngân sách giai đoạn 1 là 45,0 tỷ."),
            ("Ông Quân", "Và Nghị quyết 2: thông qua điều kiện triển khai gồm yêu cầu đóng kiến nghị mức độ cao và hoàn tất kiểm thử bảo mật trước vận hành thử."),
            ("Ông Quân", "Tôi giao việc cho anh Đạt chịu trách nhiệm cập nhật dự toán và báo cáo lại; anh Phước theo dõi rủi ro và điều kiện tuân thủ, báo cáo định kỳ cho Hội đồng quản trị. Cuộc họp kết thúc tại đây. Cảm ơn mọi người.")
        ]

        # Base time for transcript
        base_time = 0.0
        for idx, (speaker, txt) in enumerate(transcript_text):
            duration = len(txt.split()) * 0.5 # rough estimate
            chunk = TranscriptChunk(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                chunk_index=idx,
                speaker=speaker,
                text=txt,
                time_start=base_time,
                time_end=base_time + duration,
                confidence=0.95
            )
            db.add(chunk)
            base_time += duration
        db.commit()
        print("Created Transcript")

        # 7. Action Items
        actions = [
            ActionItem(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                description="Cập nhật dự toán ngân sách về 45,0 tỷ và báo cáo lại",
                owner="Ông Đạt",
                due_date=datetime(2026, 1, 15),
                priority="high",
                status="proposed"
            ),
            ActionItem(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                description="Theo dõi rủi ro và điều kiện tuân thủ, báo cáo định kỳ",
                owner="Ông Phước",
                priority="high",
                status="proposed"
            ),
            ActionItem(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                description="Nộp đủ minh chứng EVD-001 đến EVD-003",
                owner="Nhóm dự án",
                priority="critical",
                status="proposed"
            )
        ]
        db.add_all(actions)

        # 8. Decisions
        decisions = [
            DecisionItem(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                title="Phê duyệt trần ngân sách",
                description="Phê duyệt trần ngân sách giai đoạn 1 là 45,0 tỷ đồng."
            ),
            DecisionItem(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                title="Điều kiện triển khai",
                description="Yêu cầu đóng kiến nghị mức độ cao và hoàn tất kiểm thử bảo mật trước vận hành thử."
            ),
             DecisionItem(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                title="Phương án xử lý chênh lệch",
                description="Thống nhất phương án giảm 0,60 tỷ, đưa dự toán về 44,83 tỷ."
            )
        ]
        db.add_all(decisions)

        # 9. Risks
        risks = [
            RiskItem(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                description="Vượt trần ngân sách 45,0 tỷ nếu không cập nhật kịp thời",
                severity="critical"
            ),
            RiskItem(
                id=uuid.uuid4(),
                meeting_id=meeting.id,
                description="Chưa đóng đủ kiến nghị mức độ cao về kiểm soát truy cập và dữ liệu nhạy cảm",
                severity="critical"
            )
        ]
        db.add_all(risks)
        db.commit()
        print("Created Actions, Decisions, Risks")

        # 10. Meeting Minutes
        # Insert raw SQL because we don't have the model easily accessible or it's table-only
        summary_text = (
            "Cuộc họp Hội đồng Quản trị dự án ORION giai đoạn 1 đã diễn ra để xem xét và quyết nghị các vấn đề trọng yếu về ngân sách và rủi ro. "
            "Hội đồng đã thông qua Nghị quyết 1 phê duyệt trần ngân sách 45,0 tỷ đồng và phương án xử lý chênh lệch 0,60 tỷ. "
            "Đồng thời, Nghị quyết 2 được thông qua với các điều kiện bắt buộc về an ninh bảo mật (đóng kiến nghị mức độ cao). "
            "Ông Đạt và Ông Phước được giao nhiệm vụ cụ thể để triển khai và giám sát tuân thủ."
        )

        minutes_id = str(uuid.uuid4())
        insert_minutes_query = text("""
            INSERT INTO meeting_minutes (
                id, meeting_id, version, minutes_text, minutes_html,
                minutes_markdown, executive_summary, status, generated_at
            )
            VALUES (
                :id, :meeting_id, 1, :summary, :summary, :summary, :summary, 'draft', :now
            )
        """)

        db.execute(insert_minutes_query, {
            'id': minutes_id,
            'meeting_id': meeting.id,
            'summary': summary_text,
            'now': datetime.utcnow()
        })
        db.commit()
        print("Created Meeting Minutes")
        
        # ---------------------------------------------------------
        # ADDITIONAL SCENARIOS
        # ---------------------------------------------------------

        # Scenario 2: Study Session (No Record)
        study_no_record = Meeting(
            id=uuid.uuid4(),
            title="Học Online: Lập trình Python cơ bản",
            description="Buổi 1: Giới thiệu về Python và môi trường phát triển.",
            organizer_id=users_map["Ông Đạt"].id,
            project_id=None,
            start_time=datetime.utcnow() + timedelta(days=1), # Future
            end_time=datetime.utcnow() + timedelta(days=1, hours=2),
            meeting_type="study_session",
            location="Google Meet",
            phase="pre"
        )
        db.add(study_no_record)
        print("Created Scenario 2: Study (No Record)")

        # Scenario 3: Study Session (With Record + Quiz)
        study_with_record = Meeting(
            id=uuid.uuid4(),
            title="Học Online: Machine Learning Advanced",
            description="Chuyên đề: Transformer Architecture và ứng dụng trong NLP.",
            organizer_id=users_map["Ông Đạt"].id,
            project_id=None,
            start_time=datetime.utcnow() - timedelta(days=2), # Past
            end_time=datetime.utcnow() - timedelta(days=2, hours=2),
            meeting_type="study_session",
            location="Teams",
            phase="post"
        )
        db.add(study_with_record)
        
        # Transcript for Study Session
        study_transcript_text = [
            ("Ông Đạt", "Chào mọi người, hôm nay chúng ta tìm hiểu về Transformer. Đây là kiến trúc nền tảng của các mô hình LLM hiện nay."),
            ("Ông Đạt", "Cơ chế quan trọng nhất là Self-Attention, giúp mô hình hiểu ngữ cảnh của từ trong câu."),
            ("Ông Phước", "Cho em hỏi Self-Attention khác gì với RNN truyền thống ạ?"),
            ("Ông Đạt", "RNN xử lý tuần tự, còn Transformer xử lý song song nhờ Attention, nên nhanh hơn và bắt được sự phụ thuộc xa tốt hơn.")
        ]
        
        base_time = 0.0
        for idx, (speaker, txt) in enumerate(study_transcript_text):
            duration = len(txt.split()) * 0.6
            chunk = TranscriptChunk(
                id=uuid.uuid4(),
                meeting_id=study_with_record.id,
                chunk_index=idx,
                speaker=speaker,
                text=txt,
                time_start=base_time,
                time_end=base_time + duration,
                confidence=0.98
            )
            db.add(chunk)
            base_time += duration

        print("Created Scenario 3: Study (With Record)")

        # Scenario 4: Meeting (No Record)
        meeting_no_record = Meeting(
            id=uuid.uuid4(),
            title="Họp Dự án: Triển khai CRM",
            description="Kick-off dự án CRM mới cho khối Khách hàng doanh nghiệp.",
            organizer_id=users_map["Ông Quân"].id,
            project_id=project.id,
            start_time=datetime.utcnow() + timedelta(hours=5), # Upcoming today
            end_time=datetime.utcnow() + timedelta(hours=6),
            meeting_type="project_meeting",
            location="Phòng họp 101",
            phase="pre"
        )
        db.add(meeting_no_record)
        print("Created Scenario 4: Meeting (No Record)")

        db.commit()
        
        print("SEED COMPLETED SUCCESSFULLY!")

    except Exception as e:
        print(f"Error seeding data: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
