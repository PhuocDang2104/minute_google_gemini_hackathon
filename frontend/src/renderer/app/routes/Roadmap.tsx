import { ExternalLink, Github, Info, Map, BadgeDollarSign, Mail, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import FloatingNavbar from '../../components/ui/floating-navbar'
import ContactEmailForm from '../../components/ui/contact-email-form'

const Roadmap = () => {
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="roadmap-page public-page">
      <FloatingNavbar
        navItems={[
          { name: 'About', to: '/about', icon: <Info size={18} /> },
          { name: 'Lộ trình', to: '/roadmap', icon: <Map size={18} /> },
          { name: 'Pricing', to: '/pricing', icon: <BadgeDollarSign size={18} /> },
          { name: 'Contact', onClick: () => scrollToSection('contact'), icon: <Mail size={18} /> },
        ]}
        action={{ label: 'Đăng nhập', to: '/login', icon: <LogIn size={16} /> }}
      />
      <header className="landing-header">
        <div className="landing-header__brand">
          <Link to="/" className="logo" aria-label="Homepage" title="Homepage">
            <img src="/minute_icon.svg" alt="Minute" className="landing-logo__icon" />
            <span>Minute</span>
          </Link>
          <nav className="landing-nav">
            <Link to="/about" className="landing-nav__link">About</Link>
            <Link to="/roadmap" className="landing-nav__link">Lộ trình</Link>
            <Link to="/pricing" className="landing-nav__link">Pricing</Link>
            <button type="button" className="landing-nav__link" onClick={() => scrollToSection('contact')}>
              Contact
            </button>
          </nav>
        </div>
        <div className="landing-actions">
          <Link to="/login" className="btn btn-ghost">Đăng nhập</Link>
          <Link to="/register" className="btn btn-primary">Đăng ký</Link>
        </div>
      </header>

      <header className="roadmap-hero">
        <h1 className="roadmap-hero__title">Lộ trình phát triển</h1>
        <p className="roadmap-hero__subtitle">
          Tập trung vào trải nghiệm họp end-to-end, bảo mật doanh nghiệp và mở rộng tích hợp.
        </p>
        <div className="roadmap-hero__actions">
          <Link to="/register" className="btn btn-primary">
            Nhận demo
          </Link>
          <Link to="/about" className="btn btn-outline">
            Về chúng tôi
          </Link>
        </div>
      </header>

      <section className="landing-roadmap" id="roadmap">
        <div className="landing-roadmap__header">
          <h2>Lộ trình Minute</h2>
          <p>4 phiên bản phát triển cho enterprise, mở rộng dần về scale, compliance và hệ sinh thái.</p>
        </div>
        <div className="landing-roadmap__grid">
          <article className="landing-roadmap__column landing-roadmap__column--v1">
            <div className="landing-roadmap__kicker">Enterprise lớn BFSI</div>
            <div className="landing-roadmap__card">
              <div className="landing-roadmap__card-top">
                <span className="landing-roadmap__pill">Ver 1</span>
                <h3>Minute 1.0</h3>
              </div>
              <ul className="landing-roadmap__list">
                <li><strong>Auto-capture & quản lý meeting:</strong> bot auto-join (Teams/GoMeet/…), sync Outlook, gán theo dự án.</li>
                <li><strong>Transcript + diarization:</strong> speaker đúng, ngắt câu/định dạng đọc được.</li>
                <li><strong>Minutes chuẩn BFSI:</strong> summary/decision/action (owner, due date), highlight 5–10 điểm quan trọng.</li>
                <li><strong>Export & phân phối:</strong> DOCX/PDF, share link phân quyền, version draft/final tối thiểu.</li>
                <li><strong>Ứng dụng + extension:</strong> trải nghiệm mượt, tuỳ biến workflow nhanh.</li>
                <li><strong>Triển khai & bảo mật:</strong> VPC/on-prem, RBAC cơ bản, mã hoá + access log.</li>
              </ul>
            </div>
          </article>
          <article className="landing-roadmap__column landing-roadmap__column--v2">
            <div className="landing-roadmap__kicker">Enterprise đa lĩnh vực</div>
            <div className="landing-roadmap__card">
              <div className="landing-roadmap__card-top">
                <span className="landing-roadmap__pill">Ver 2</span>
                <h3>Minute 2.0</h3>
              </div>
              <ul className="landing-roadmap__list">
                <li><strong>Admin platform:</strong> multi-workspace/branch, RBAC vai trò, policy theo đơn vị.</li>
                <li><strong>Approval workflow:</strong> drafter → reviewer → approver, track changes + versioning.</li>
                <li><strong>Minutes theo ngành/role:</strong> template library + taxonomy/thuật ngữ theo domain.</li>
                <li><strong>Quality tuning + review:</strong> confidence/flag kiểm tra decision/action.</li>
                <li><strong>Model mode + slide-aware:</strong> Fast/Strong và OCR/IDP theo slide/metrics/title.</li>
                <li><strong>Voice identity (opt-in):</strong> gắn speaker tốt hơn; eKYC giọng nói nên là add-on Ver3 "Identity Verification".</li>
              </ul>
            </div>
          </article>
          <article className="landing-roadmap__column landing-roadmap__column--v3">
            <div className="landing-roadmap__kicker">Packs (Enterprise + SME)</div>
            <div className="landing-roadmap__card">
              <div className="landing-roadmap__card-top">
                <span className="landing-roadmap__pill">Ver 3</span>
                <h3>Minute 3.0</h3>
              </div>
              <div className="landing-roadmap__packs">
                <div className="landing-roadmap__pack">
                  <div className="landing-roadmap__pack-title">Enterprise Pack</div>
                  <ul className="landing-roadmap__list">
                    <li><strong>Knowledge Base + Agentic RAG:</strong> theo dự án/ngành (trước & sau họp).</li>
                    <li><strong>Citation/traceability:</strong> minutes & trả lời có dẫn nguồn transcript/timestamp.</li>
                    <li><strong>eDiscovery nâng cao:</strong> search tiêu chí, export bundle phục vụ audit/điều tra.</li>
                    <li><strong>Action governance:</strong> nhắc hạn/escalation theo policy; báo cáo blockers.</li>
                    <li><strong>Cross-meeting insights:</strong> mâu thuẫn quyết định, trùng đầu việc, chủ đề lặp.</li>
                  </ul>
                </div>
                <div className="landing-roadmap__pack landing-roadmap__pack--muted">
                  <div className="landing-roadmap__pack-title">SME Pack</div>
                  <ul className="landing-roadmap__list">
                    <li><strong>Self-serve + auto-share:</strong> bật là dùng, tự gửi minutes vào Slack/Teams.</li>
                    <li><strong>Task sync cơ bản:</strong> 1-click đẩy action sang tool phổ biến.</li>
                    <li><strong>Cost controls + quota:</strong> usage/minutes/storage/retention theo gói.</li>
                  </ul>
                </div>
              </div>
            </div>
          </article>
          <article className="landing-roadmap__column landing-roadmap__column--v4">
            <div className="landing-roadmap__kicker">Lite + Ecosystem</div>
            <div className="landing-roadmap__card">
              <div className="landing-roadmap__card-top">
                <span className="landing-roadmap__pill">Ver 4</span>
                <h3>Minute Ecosystem</h3>
              </div>
              <div className="landing-roadmap__split">
                <div className="landing-roadmap__pack">
                  <div className="landing-roadmap__pack-title">Lite</div>
                  <ul className="landing-roadmap__list">
                    <li><strong>Core loop tối giản:</strong> meeting → summary → action items (ổn định, nhanh).</li>
                    <li><strong>Search & share:</strong> tìm theo meeting/minutes + link/export.</li>
                    <li><strong>Mobile-friendly minutes:</strong> đọc nhanh, tick action, UX nhẹ.</li>
                  </ul>
                </div>
                <div className="landing-roadmap__pack landing-roadmap__pack--muted">
                  <div className="landing-roadmap__pack-title">Ecosystem</div>
                  <ul className="landing-roadmap__list">
                    <li><strong>Integrations rộng:</strong> CRM/ticketing/DMS/chat-collab/calendar đa hệ.</li>
                    <li><strong>Marketplace/Partner:</strong> cài integration theo ngành/công ty, quản trị permission scopes.</li>
                    <li><strong>Multi-language/multi-region:</strong> mở rộng thị trường & vận hành tập đoàn.</li>
                    <li><strong>Workflow triggers:</strong> minutes finalized → create/update ticket/CRM, decision → notify + log.</li>
                  </ul>
                </div>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="contact" id="contact">
        <div className="contact-card">
          <div className="contact-content">
            <h2>Liên hệ</h2>
            <p>Nhận demo, báo giá hoặc tư vấn triển khai cho doanh nghiệp.</p>
            <div className="contact-tags">
              <span className="contact-tag">Demo nhanh</span>
              <span className="contact-tag">Tư vấn triển khai</span>
              <span className="contact-tag">Bảo mật doanh nghiệp</span>
            </div>
          </div>
          <div className="contact-panel">
            <ContactEmailForm />
            <div className="contact-actions">
              <Link to="/register" className="btn btn-primary btn-lg">Nhận demo</Link>
              <Link to="/about" className="btn btn-outline btn-lg">Về chúng tôi</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-brand">
          <img src="/minute_icon.svg" alt="Minute" className="landing-logo__icon landing-logo__icon--sm" />
          <span>Minute</span>
        </div>
        <a
          className="landing-footer__link"
          href="https://github.com/PhuocDang2104/vnpt_ai_hackathon_meetmate"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Github size={18} />
          GitHub
          <ExternalLink size={14} />
        </a>
        <p>© 2024 Minute - AI Meeting Assistant for Enterprise</p>
      </footer>
    </div>
  )
}

export default Roadmap
