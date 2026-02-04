import { ExternalLink, Github, Info, Map, BadgeDollarSign, Mail, LogIn } from 'lucide-react'
import { Link } from 'react-router-dom'
import FloatingNavbar from '../../components/ui/floating-navbar'
import ContactEmailForm from '../../components/ui/contact-email-form'

const Pricing = () => {
  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="pricing-page public-page">
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

      <header className="pricing-hero">
        <h1 className="pricing-hero__title">Bảng giá linh hoạt</h1>
        <p className="pricing-hero__subtitle">
          Chọn gói phù hợp, dễ mở rộng khi nhu cầu tăng.
        </p>
        <div className="pricing-hero__actions">
          <Link to="/register" className="btn btn-primary">
            Nhận demo
          </Link>
          <Link to="/about" className="btn btn-outline">
            Về chúng tôi
          </Link>
        </div>
      </header>

      <section className="pricing">
        <div className="pricing__header">
          <h2>Pricing linh hoạt theo quy mô</h2>
          <p>Chọn gói phù hợp, dễ mở rộng khi nhu cầu tăng.</p>
        </div>
        <div className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-tier">Pilot</div>
            <div className="pricing-price">Dùng thử</div>
            <p className="pricing-desc">Cho nhóm nhỏ muốn thử nghiệm nhanh.</p>
            <ul className="pricing-list">
              <li>Thiết lập nhanh trong 1-2 tuần</li>
              <li>Pre/In/Post cơ bản</li>
              <li>Hỗ trợ onboarding</li>
            </ul>
            <Link to="/register" className="btn btn-outline pricing-cta">
              Nhận demo
            </Link>
          </div>
          <div className="pricing-card pricing-card--featured">
            <div className="pricing-tier">Business</div>
            <div className="pricing-price">Theo gói</div>
            <p className="pricing-desc">Dành cho phòng ban và trung tâm PMO.</p>
            <ul className="pricing-list">
              <li>Tích hợp lịch & kho tài liệu</li>
              <li>Workflow tùy chỉnh theo loại họp</li>
              <li>SLA hỗ trợ giờ hành chính</li>
            </ul>
            <Link to="/register" className="btn btn-primary pricing-cta">
              Nhận báo giá
            </Link>
          </div>
          <div className="pricing-card">
            <div className="pricing-tier">Enterprise</div>
            <div className="pricing-price">Liên hệ</div>
            <p className="pricing-desc">Triển khai quy mô lớn, bảo mật nâng cao.</p>
            <ul className="pricing-list">
              <li>SSO, phân quyền & audit</li>
              <li>Tùy chỉnh RAG theo data nội bộ</li>
              <li>Hỗ trợ 24/7 & dedicated team</li>
            </ul>
            <Link to="/register" className="btn btn-outline pricing-cta">
              Liên hệ
            </Link>
          </div>
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

export default Pricing
