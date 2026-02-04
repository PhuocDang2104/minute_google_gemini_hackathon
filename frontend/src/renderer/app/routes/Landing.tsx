/**
 * Landing Page - Welcome to Minute
 */
import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  MessageSquare,
  FileText,
  CheckSquare,
  ArrowRight,
  Info,
  Map,
  BadgeDollarSign,
  Mail,
  Github,
  ExternalLink,
} from 'lucide-react';
import BackgroundRippleEffect from '../../components/ui/background-ripple-effect';
import FloatingNavbar from '../../components/ui/floating-navbar';
import { MarketingPopup } from '../../components/MarketingPopup';
import ContactEmailForm from '../../components/ui/contact-email-form';

export const Landing: React.FC = () => {
  useEffect(() => {
    const root = document.querySelector('.landing-page');
    if (!root) return;
    const elements = Array.from(root.querySelectorAll<HTMLElement>('.reveal-on-scroll'));
    if (elements.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    );

    elements.forEach((el, index) => {
      const delay = (index % 6) * 90;
      el.style.setProperty('--reveal-delay', `${delay}ms`);
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="landing-page public-page">
      <MarketingPopup />
      <FloatingNavbar
        navItems={[
          { name: 'About', to: '/about', icon: <Info size={18} /> },
          { name: 'Lộ trình', to: '/roadmap', icon: <Map size={18} /> },
          { name: 'Pricing', to: '/pricing', icon: <BadgeDollarSign size={18} /> },
          { name: 'Contact', onClick: () => scrollToSection('contact'), icon: <Mail size={18} /> },
        ]}
        action={{ label: 'Get Started', to: '/app/meetings', icon: <ArrowRight size={16} /> }}
      />
      {/* Header */}
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
          <Link to="/app/meetings" className="btn btn-primary">Get Started</Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero reveal-on-scroll">
        <div className="hero-stage reveal-on-scroll">
          <BackgroundRippleEffect rows={14} cols={30} cellSize={48} />
          <div className="hero-stage__content">
            <h1 className="hero-title">
              Cuộc họp hiệu quả hơn với <span className="gradient-text">AI Assistant</span>
            </h1>
            <p className="hero-subtitle">
              Minute giúp bạn chuẩn bị, ghi chép và theo dõi cuộc họp tự động.
              Tiết kiệm thời gian, không bỏ lỡ action items quan trọng.
            </p>
            <div className="hero-actions">
              <Link to="/about" className="btn btn-outline btn-lg hero-cta hero-cta--ghost">
                Tìm hiểu về chúng tôi
                <ArrowRight size={18} />
              </Link>
              <Link to="/app/meetings" className="btn btn-primary btn-lg hero-cta hero-cta--primary hero-login">
                Get Started
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <h2 className="reveal-on-scroll">Tính năng nổi bật</h2>
        <div className="features-grid">
          <div className="feature-card reveal-on-scroll">
            <div className="feature-card__header">
              <div className="feature-icon">
                <Calendar />
              </div>
              <h3>Pre-Meeting</h3>
              <p className="feature-card__summary">
                AI tự động tạo agenda, gợi ý tài liệu pre-read và người cần mời.
              </p>
            </div>
            <div className="feature-card__expanded">
              <div className="feature-card__details">
                <p className="feature-card__desc">
                  Minute đồng bộ lịch từ Outlook, Teams, VNPT..., nhận diện chủ đề và đơn vị tham gia,
                  rồi dùng RAG để tra cứu kho tài liệu nội bộ, chọn đúng policy, proposal và biên bản liên
                  quan. Tất cả được đóng gói thành pre-read pack kèm agenda gợi ý.
                </p>
                <ul className="feature-card__list">
                  <li>Đồng bộ lịch và nhận diện bối cảnh cuộc họp</li>
                  <li>Tra cứu policy/proposal/biên bản liên quan bằng RAG</li>
                  <li>Tạo pre-read pack và agenda gửi trước</li>
                  <li>Gợi ý câu hỏi trọng tâm cho người tham dự</li>
                </ul>
              </div>
              <div className="feature-card__media">
                <img src="/landing/pre.png" alt="Pre-meeting overview" />
              </div>
            </div>
          </div>
          <div className="feature-card reveal-on-scroll">
            <div className="feature-card__header">
              <div className="feature-icon">
                <MessageSquare />
              </div>
              <h3>In-Meeting</h3>
              <p className="feature-card__summary">
                Ghi chép real-time, phát hiện action items, decisions và risks.
              </p>
            </div>
            <div className="feature-card__expanded">
              <div className="feature-card__details">
                <p className="feature-card__desc">
                  Bot Minute tham gia như một thành viên, hiển thị Live Notes – Actions – Ask AI. Hệ
                  thống ghi theo từng người nói, recap liên tục theo timeline, nhận diện Action/Decision/Risk
                  và gợi ý tạo nhiệm vụ, lịch follow-up, mở tài liệu liên quan. Mọi thao tác đều có một bước
                  xác nhận.
                </p>
                <ul className="feature-card__list">
                  <li>Live Notes theo từng người nói và recap timeline</li>
                  <li>Tự động nhận diện Action/Decision/Risk</li>
                  <li>Gợi ý tạo nhiệm vụ và lịch follow-up</li>
                  <li>Ask AI dựa trên tài liệu nội bộ có xác nhận</li>
                </ul>
              </div>
              <div className="feature-card__media">
                <img src="/landing/in.png" alt="In-meeting assistant" />
              </div>
            </div>
          </div>
          <div className="feature-card reveal-on-scroll">
            <div className="feature-card__header">
              <div className="feature-icon">
                <FileText />
              </div>
              <h3>Post-Meeting</h3>
              <p className="feature-card__summary">
                Tự động tạo biên bản, sync tasks với Jira/Planner, gửi MoM.
              </p>
            </div>
            <div className="feature-card__expanded">
              <div className="feature-card__details">
                <p className="feature-card__desc">
                  Sau khi kết thúc, Minute tạo biên bản chuẩn với mục tiêu, nội dung chính, quyết định,
                  hành động và rủi ro kèm timecode. Các đầu việc đồng bộ sang Planner/Jira/Work hoặc hệ
                  thống nội bộ, gán đúng owner và deadline.
                </p>
                <ul className="feature-card__list">
                  <li>Biên bản chuẩn có timecode</li>
                  <li>Action/Decision với owner và deadline</li>
                  <li>Đồng bộ Planner/Jira/Work</li>
                  <li>Tra cứu lại quyết định theo cuộc họp</li>
                </ul>
              </div>
              <div className="feature-card__media">
                <img src="/landing/post.png" alt="Post-meeting summary" />
              </div>
            </div>
          </div>
          <div className="feature-card reveal-on-scroll">
            <div className="feature-card__header">
              <div className="feature-icon">
                <CheckSquare />
              </div>
              <h3>RAG Q&A</h3>
              <p className="feature-card__summary">
                Hỏi đáp documents, policies với AI và citations chính xác.
              </p>
            </div>
            <div className="feature-card__expanded">
              <div className="feature-card__details">
                <p className="feature-card__desc">
                  Hỏi đáp nhanh policy, số liệu, tài liệu nội bộ theo ngữ cảnh dự án. Câu trả lời có trích
                  dẫn nguồn, gợi ý câu hỏi tiếp theo và tuân thủ quyền truy cập.
                </p>
                <ul className="feature-card__list">
                  <li>Tìm đúng tài liệu theo ngữ cảnh dự án</li>
                  <li>Câu trả lời có trích dẫn nguồn</li>
                  <li>Gợi ý câu hỏi tiếp theo</li>
                  <li>Tuân thủ quyền truy cập tài liệu</li>
                </ul>
              </div>
              <div className="feature-card__media">
                <img src="/landing/rag.png" alt="RAG Q&A" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="benefits">
        <div className="benefits-rail">
          <div className="benefit-item reveal-on-scroll">
            <div className="benefit-value">24/7</div>
            <p className="benefit-desc">
              Sẵn sàng tham gia mọi cuộc họp, từ call đột xuất tới phiên họp ủy ban định kỳ
            </p>
          </div>
          <div className="benefit-item reveal-on-scroll">
            <div className="benefit-value">90%</div>
            <p className="benefit-desc">
              Khối lượng ghi chép và soạn biên bản thủ công có thể được tự động hóa
            </p>
          </div>
          <div className="benefit-item reveal-on-scroll">
            <div className="benefit-value">2×</div>
            <p className="benefit-desc">
              Tốc độ chốt quyết định và giao việc sau họp được đẩy nhanh gấp đôi nhờ RAG và AI Agents
            </p>
          </div>
          <div className="benefit-item reveal-on-scroll">
            <div className="benefit-value">0 thông tin bị bỏ lỡ</div>
            <p className="benefit-desc">
              Mỗi quyết định đều được ghi lại, gắn người chịu trách nhiệm và dễ dàng truy vết khi cần
            </p>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="comparison">
        <div className="comparison__header reveal-on-scroll">
          <h2>Trước và sau khi có Minute</h2>
        </div>
        <div className="comparison-shell">
          <div className="comparison-panel comparison-panel--without reveal-on-scroll">
            <h3 className="comparison-title">Không dùng Minute</h3>
            <ul className="comparison-list comparison-list--without">
              <li>Tồn đọng biên bản và các đầu việc follow-up sau họp.</li>
              <li>Quyết định quan trọng chỉ nằm trong trí nhớ từng người.</li>
              <li>Ghi chép, tổng hợp thủ công, tốn nhiều giờ làm việc giá trị thấp.</li>
              <li>Khó truy vết: “Cuộc họp nào đã chốt điều này? Ai chịu trách nhiệm?”</li>
              <li>Áp lực lên thư ký, PM, RM; rủi ro miss việc, miss deadline.</li>
            </ul>
          </div>
          <div className="comparison-divider">
            <span>VS</span>
          </div>
          <div className="comparison-panel comparison-panel--with reveal-on-scroll">
            <h3 className="comparison-title">Khi có Minute</h3>
            <ul className="comparison-list comparison-list--with">
              <li>Nền tảng AI khép kín Pre – In – Post cho mọi cuộc họp.</li>
              <li>Biên bản, quyết định và hành động được tự động hóa, chuẩn hóa.</li>
              <li>Nhiều thời gian hơn cho phân tích, phục vụ khách hàng và ra quyết định.</li>
              <li>Lịch sử họp và quyết định minh bạch, truy vết được cho audit và quản trị rủi ro.</li>
              <li>Quy trình follow-up, giao việc sau họp vận hành mượt mà, không bỏ sót.</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Roadmap Section */}
      <section className="landing-roadmap" id="roadmap">
        <div className="landing-roadmap__header reveal-on-scroll">
          <h2>Lộ trình Minute</h2>
          <p>4 phiên bản phát triển cho enterprise, mở rộng dần về scale, compliance và hệ sinh thái.</p>
        </div>
        <div className="landing-roadmap__grid">
          <article className="landing-roadmap__column landing-roadmap__column--v1 reveal-on-scroll">
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
          <article className="landing-roadmap__column landing-roadmap__column--v2 reveal-on-scroll">
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
          <article className="landing-roadmap__column landing-roadmap__column--v3 reveal-on-scroll">
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
          <article className="landing-roadmap__column landing-roadmap__column--v4 reveal-on-scroll">
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

      {/* CTA Section */}
      <section className="cta reveal-on-scroll">
        <h2>Sẵn sàng nâng cấp cuộc họp?</h2>
        <p>Bắt đầu sử dụng Minute miễn phí ngay</p>
        <Link to="/app/meetings" className="btn btn-primary btn-lg cta-button">
          Get Started
          <ArrowRight size={20} />
        </Link>
      </section>

      {/* Contact Section */}
      <section className="contact" id="contact">
        <div className="contact-card reveal-on-scroll">
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
              <Link to="/app/meetings" className="btn btn-primary btn-lg">Get Started</Link>
              <Link to="/about" className="btn btn-outline btn-lg">Về chúng tôi</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer reveal-on-scroll">
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

      <style>{`
        .landing-page {
          min-height: 100vh;
          background: var(--bg-base);
          color: var(--text-primary);
        }

        /* Header */
        .landing-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-sm) var(--space-xl);
          max-width: 1200px;
          margin: 0 auto;
          gap: var(--space-lg);
        }

        .landing-header__brand {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          flex: 1;
          min-width: 0;
        }

        .logo {
          display: flex;
          align-items: center;
          gap: var(--space-xs);
          font-family: var(--font-heading);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent);
          text-decoration: none;
        }

        .landing-logo__icon {
          width: 32px;
          height: 32px;
          object-fit: contain;
          filter: drop-shadow(0 8px 16px rgba(247, 167, 69, 0.35));
        }

        .landing-logo__icon--sm {
          width: 22px;
          height: 22px;
        }

        .landing-nav {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          flex-wrap: wrap;
        }

        .landing-nav__link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--text-secondary);
          background: transparent;
          border: 1px solid transparent;
          border-radius: 999px;
          cursor: pointer;
          text-decoration: none;
          font-family: inherit;
          transition: transform 0.2s ease, color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
        }

        .landing-nav__link:hover {
          color: var(--accent);
          background: var(--accent-subtle);
          border-color: rgba(247, 167, 69, 0.4);
          transform: translateY(-1px);
        }

        .landing-nav__link:focus-visible {
          outline: 2px solid rgba(247, 167, 69, 0.45);
          outline-offset: 2px;
        }

        .landing-actions {
          display: flex;
          align-items: center;
          gap: var(--space-sm);
        }

        /* Hero */
        .hero {
          padding: var(--space-lg) 0;
        }

        .hero-stage {
          width: 100%;
          aspect-ratio: 24 / 9;
          border-radius: 0;
          border: 1px solid var(--border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 247, 247, 0.9));
          box-shadow: 0 24px 60px rgba(15, 23, 42, 0.15);
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
        }

        .hero-stage__content {
          position: relative;
          z-index: 4;
          text-align: center;
          max-width: 720px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-md);
          padding: var(--space-xl) 0;
          pointer-events: none;
        }

        .hero-title {
          font-family: var(--font-heading);
          font-size: 3rem;
          font-weight: 700;
          line-height: 1.15;
          margin: 0;
        }

        .gradient-text {
          background: linear-gradient(135deg, var(--accent), #d9822b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-subtitle {
          font-size: 1.25rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
          max-width: 620px;
        }

        .hero-actions {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: var(--space-sm);
          margin-top: var(--space-sm);
          flex-wrap: wrap;
          justify-content: center;
          pointer-events: auto;
        }

        .hero-login {
          min-width: 200px;
        }

        .hero-cta {
          position: relative;
          border-radius: 999px;
          font-weight: 600;
          letter-spacing: 0.01em;
          padding: 14px 26px;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .hero-cta--primary {
          background: var(--cta-gradient);
          color: var(--text-on-accent);
          border: 1px solid rgba(247, 167, 69, 0.5);
          box-shadow: 0 12px 24px rgba(247, 167, 69, 0.35);
        }

        .hero-cta--primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 32px rgba(247, 167, 69, 0.45);
        }

        .hero-cta--ghost {
          border: 1px solid rgba(17, 17, 17, 0.2);
          background: rgba(255, 255, 255, 0.75);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
        }

        .hero-cta--ghost:hover {
          transform: translateY(-2px);
          border-color: rgba(247, 167, 69, 0.5);
          color: var(--accent);
        }

        /* Features */
        .features {
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-2xl) var(--space-xl);
          text-align: center;
        }

        .features h2 {
          font-family: var(--font-heading);
          font-size: 2rem;
          margin-bottom: var(--space-xl);
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: var(--space-lg);
          align-items: stretch;
          transition: grid-template-columns 0.7s cubic-bezier(0.22, 0.61, 0.36, 1),
            gap 0.4s ease;
        }

        .feature-card {
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: var(--space-lg);
          text-align: left;
          transition: transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1),
            border-color 0.35s ease,
            box-shadow 0.35s ease,
            opacity 0.35s ease,
            min-height 0.6s cubic-bezier(0.22, 0.61, 0.36, 1);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          min-width: 0;
          position: relative;
          overflow: hidden;
          min-height: 240px;
          will-change: transform;
        }

        .feature-card__header {
          display: flex;
          flex-direction: column;
          gap: var(--space-xs);
        }

        .features-grid:hover .feature-card {
          opacity: 0.7;
        }

        .features-grid:hover .feature-card:hover {
          opacity: 1;
          transform: translateY(-4px);
          border-color: var(--accent);
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
          min-height: 380px;
        }

        @supports selector(:has(*)) {
          .features-grid:has(.feature-card:nth-child(1):hover) {
            grid-template-columns: 9fr 1fr 1fr 1fr;
          }

          .features-grid:has(.feature-card:nth-child(2):hover) {
            grid-template-columns: 1fr 9fr 1fr 1fr;
          }

          .features-grid:has(.feature-card:nth-child(3):hover) {
            grid-template-columns: 1fr 1fr 9fr 1fr;
          }

          .features-grid:has(.feature-card:nth-child(4):hover) {
            grid-template-columns: 1fr 1fr 1fr 9fr;
          }
        }

        .feature-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: rgba(234, 179, 8, 0.1);
          border-radius: var(--radius-md);
          color: var(--accent);
          margin-bottom: 0;
        }

        .feature-card__header h3 {
          font-family: var(--font-heading);
          font-size: 1.125rem;
          margin: 0;
        }

        .feature-card__summary {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .feature-card__expanded {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(180px, 240px);
          gap: var(--space-md);
          align-items: center;
          margin-top: var(--space-sm);
          opacity: 0;
          max-height: 0;
          transform: translateY(8px);
          transition: none;
          overflow: hidden;
        }

        .feature-card:hover .feature-card__expanded {
          opacity: 1;
          max-height: 420px;
          transform: translateY(0);
          transition: max-height 0.6s cubic-bezier(0.22, 0.61, 0.36, 1),
            opacity 0.35s ease,
            transform 0.45s ease;
        }

        .feature-card__desc {
          font-size: 0.9rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0 0 var(--space-sm);
        }

        .feature-card__list {
          margin: 0;
          padding-left: 18px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: var(--text-secondary);
          font-size: 0.85rem;
          line-height: 1.5;
        }

        .feature-card__media {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .feature-card__media img {
          width: 100%;
          max-width: 220px;
          height: auto;
          object-fit: contain;
          border-radius: 14px;
          border: 1px solid var(--border);
          background: #fff;
          padding: var(--space-sm);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
        }

        /* Benefits */
        .benefits {
          padding: var(--space-2xl) var(--space-xl);
          background:
            radial-gradient(circle at 20% -20%, rgba(247, 167, 69, 0.12), transparent 50%),
            radial-gradient(circle at 80% 120%, rgba(247, 167, 69, 0.1), transparent 55%),
            var(--bg-surface);
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
        }

        .benefits-rail {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: var(--space-xl);
          position: relative;
          padding: var(--space-lg) 0;
        }

        .benefits-rail::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 6px;
          height: 2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(247, 167, 69, 0.35) 20%,
            rgba(247, 167, 69, 0.7) 50%,
            rgba(247, 167, 69, 0.35) 80%,
            transparent 100%
          );
          opacity: 0.7;
          animation: rail-sweep 10s ease-in-out infinite;
        }

        .benefits-rail::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          bottom: 6px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.08), transparent);
        }

        .benefit-item {
          position: relative;
          padding: var(--space-lg) var(--space-md) var(--space-lg) var(--space-lg);
          min-height: 160px;
          transition: transform 0.25s ease, color 0.25s ease;
        }

        .benefit-item::before {
          content: '';
          position: absolute;
          left: var(--space-sm);
          top: var(--space-md);
          bottom: var(--space-md);
          width: 1px;
          background: linear-gradient(180deg, transparent, rgba(247, 167, 69, 0.5), transparent);
          opacity: 0.6;
        }

        .benefit-item::after {
          content: '';
          position: absolute;
          left: calc(var(--space-sm) - 3px);
          top: var(--space-md);
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--accent);
          box-shadow: 0 0 0 6px rgba(247, 167, 69, 0.12);
          transition: transform 0.25s ease, box-shadow 0.25s ease;
        }

        .benefit-item:hover {
          transform: translateY(-6px);
        }

        .benefit-item:hover::after {
          transform: scale(1.15);
          box-shadow: 0 0 0 8px rgba(247, 167, 69, 0.2);
        }

        .benefit-value {
          font-family: var(--font-heading);
          font-size: clamp(1.6rem, 2.4vw, 2.2rem);
          font-weight: 700;
          letter-spacing: 0.02em;
          margin-bottom: var(--space-sm);
          color: var(--text-primary);
          transition: color 0.25s ease;
        }

        .benefit-desc {
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin: 0;
          transition: color 0.25s ease;
        }

        .benefit-item:hover .benefit-value {
          color: var(--accent);
        }

        @keyframes rail-sweep {
          0%,
          100% {
            opacity: 0.4;
            transform: translateX(-4%);
          }
          50% {
            opacity: 0.75;
            transform: translateX(4%);
          }
        }

        /* Contact */
        .contact {
          padding: var(--space-2xl) var(--space-xl);
          background: var(--bg-base);
        }

        .contact-card {
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-xl);
          border-radius: 24px;
          border: 1px solid var(--border);
          background: linear-gradient(135deg, rgba(247, 167, 69, 0.16), rgba(255, 255, 255, 0.95));
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
          align-items: stretch;
          gap: var(--space-lg);
        }

        .contact-content {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
          flex: 1;
        }

        .contact-content h2 {
          font-family: var(--font-heading);
          font-size: 2rem;
          margin: 0;
        }

        .contact-content p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 1rem;
          line-height: 1.6;
        }

        .contact-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-sm);
        }

        .contact-tag {
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(247, 167, 69, 0.15);
          border: 1px solid rgba(247, 167, 69, 0.4);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--accent);
        }

        .contact-panel {
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          padding: var(--space-lg);
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(247, 167, 69, 0.35);
          box-shadow: 0 12px 24px rgba(15, 23, 42, 0.12);
        }

        .contact-panel .contact-form {
          margin-top: 0;
        }

        .contact-actions {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--space-sm);
        }

        .contact-actions .btn {
          width: 100%;
          justify-content: center;
        }

        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(18px) scale(0.98);
          transition: opacity 0.6s ease, transform 0.6s ease;
          transition-delay: var(--reveal-delay, 0ms);
          will-change: opacity, transform;
        }

        .reveal-on-scroll.is-visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        /* Comparison */
        .comparison {
          padding: var(--space-2xl) var(--space-xl);
          background: linear-gradient(180deg, #ffffff 0%, #f8f8f8 100%);
        }

        .comparison__header {
          max-width: 820px;
          margin: 0 auto var(--space-xl);
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .comparison__header h2 {
          font-family: var(--font-heading);
          font-size: 2rem;
          margin: 0;
        }

        .comparison-shell {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 72px minmax(0, 1fr);
          gap: var(--space-lg);
          align-items: stretch;
        }

        .comparison-panel {
          position: relative;
          padding: var(--space-xl);
          border-radius: 22px;
          border: 1px solid var(--border);
          background: #ffffff;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
          display: flex;
          flex-direction: column;
          gap: var(--space-md);
          overflow: hidden;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }

        .comparison-panel:hover {
          transform: translateY(-6px);
        }

        .comparison-panel::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 4px;
          opacity: 0.8;
        }

        .comparison-panel--without {
          background: linear-gradient(180deg, #ffffff 0%, #f7f7f7 100%);
        }

        .comparison-panel--without::after {
          background: linear-gradient(90deg, rgba(239, 68, 68, 0.35), transparent);
        }

        .comparison-panel--with {
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 167, 69, 0.1));
          border-color: rgba(247, 167, 69, 0.35);
          box-shadow: 0 24px 50px rgba(247, 167, 69, 0.18);
        }

        .comparison-panel--with::after {
          background: linear-gradient(90deg, rgba(34, 197, 94, 0.4), transparent);
        }

        .comparison-title {
          font-family: var(--font-heading);
          font-size: 1.15rem;
          margin: 0;
        }

        .comparison-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }

        .comparison-list li {
          position: relative;
          padding-left: 28px;
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .comparison-list li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 6px;
          width: 18px;
          height: 18px;
          border-radius: 999px;
          border: 1px solid transparent;
        }

        .comparison-list--without li::before {
          border-color: rgba(239, 68, 68, 0.5);
          background: rgba(239, 68, 68, 0.08);
        }

        .comparison-list--without li::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 10px;
          width: 10px;
          height: 10px;
          background:
            linear-gradient(45deg, transparent 45%, rgba(239, 68, 68, 0.9) 45%, rgba(239, 68, 68, 0.9) 55%, transparent 55%),
            linear-gradient(-45deg, transparent 45%, rgba(239, 68, 68, 0.9) 45%, rgba(239, 68, 68, 0.9) 55%, transparent 55%);
        }

        .comparison-list--with li::before {
          border-color: rgba(34, 197, 94, 0.45);
          background: rgba(34, 197, 94, 0.08);
        }

        .comparison-list--with li::after {
          content: '';
          position: absolute;
          left: 5px;
          top: 11px;
          width: 8px;
          height: 4px;
          border-left: 2px solid rgba(34, 197, 94, 0.9);
          border-bottom: 2px solid rgba(34, 197, 94, 0.9);
          transform: rotate(-45deg);
        }

        .comparison-divider {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .comparison-divider::before {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(180deg, transparent, rgba(0, 0, 0, 0.15), transparent);
        }

        .comparison-divider span {
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--text-muted);
          background: #ffffff;
          border: 1px solid var(--border);
          border-radius: 999px;
          padding: 6px 12px;
          box-shadow: 0 10px 20px rgba(15, 23, 42, 0.1);
        }

        /* CTA */
        .cta {
          text-align: center;
          padding: var(--space-2xl);
          max-width: 600px;
          margin: 0 auto;
        }

        .cta h2 {
          font-family: var(--font-heading);
          font-size: 2rem;
          margin-bottom: var(--space-sm);
        }

        .cta p {
          color: var(--text-secondary);
          margin-bottom: var(--space-lg);
        }

        /* Footer */
        .landing-footer {
          text-align: center;
          padding: var(--space-xl);
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-xs);
        }

        .footer-brand {
          display: inline-flex;
          align-items: center;
          gap: var(--space-xs);
          font-family: var(--font-heading);
          font-weight: 600;
          color: var(--accent);
        }

        .landing-footer__link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.85rem;
          color: var(--text-secondary);
          text-decoration: none;
          transition: color 0.2s ease;
        }

        .landing-footer__link:hover {
          color: var(--accent);
        }

        .landing-footer p {
          font-size: 0.875rem;
          color: var(--text-secondary);
          margin: 0;
        }

        /* Buttons */
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--space-xs);
          padding: var(--space-sm) var(--space-md);
          border-radius: var(--radius-sm);
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          text-decoration: none;
        }

        .btn-primary {
          background: var(--accent);
          color: #1a1a1a;
        }

        .btn-primary:hover {
          background: var(--accent-hover);
        }

        .btn-outline {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-primary);
        }

        .btn-outline:hover {
          border-color: var(--accent);
          color: var(--accent);
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-primary);
        }

        .btn-ghost:hover {
          color: var(--accent);
        }

        .btn-lg {
          padding: var(--space-md) var(--space-lg);
          font-size: 1.125rem;
        }

        .cta-button {
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(247, 167, 69, 0.6);
          background: linear-gradient(135deg, #f9c46a 0%, #f7a745 45%, #c8873b 100%);
          box-shadow: 0 18px 36px rgba(247, 167, 69, 0.38);
          transform: translateZ(0);
          transition: box-shadow 0.2s ease, filter 0.2s ease;
        }

        .cta-button::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%);
          transform: translateX(-120%);
          opacity: 0;
        }

        .cta-button::after {
          content: '';
          position: absolute;
          inset: -35%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.35), transparent 60%);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .cta-button:hover {
          box-shadow: 0 26px 48px rgba(247, 167, 69, 0.5), 0 0 0 1px rgba(247, 167, 69, 0.5);
          filter: saturate(1.08);
          animation: cta-rumble 0.35s ease-in-out infinite;
        }

        .cta-button:hover::before {
          opacity: 1;
          animation: cta-sheen 0.9s ease infinite;
        }

        .cta-button:hover::after {
          opacity: 0.9;
        }

        @keyframes cta-sheen {
          0% {
            transform: translateX(-120%);
          }
          60% {
            transform: translateX(120%);
          }
          100% {
            transform: translateX(120%);
          }
        }

        @keyframes cta-rumble {
          0% {
            transform: translate(0, -3px) scale(1.02);
          }
          25% {
            transform: translate(-1px, -4px) scale(1.02);
          }
          50% {
            transform: translate(1px, -3px) scale(1.02);
          }
          75% {
            transform: translate(-0.5px, -4px) scale(1.02);
          }
          100% {
            transform: translate(0, -3px) scale(1.02);
          }
        }

        /* Responsive */
        @media (max-width: 1024px) {
          .features-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            transition: none;
          }

          .benefits-rail {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .hero-stage {
            aspect-ratio: 18 / 9;
          }

          .features-grid:hover .feature-card {
            opacity: 1;
          }

          .features-grid:hover .feature-card:hover {
            transform: none;
            min-height: auto;
          }

          .feature-card__expanded {
            opacity: 1;
            max-height: none;
            transform: none;
          }
        }

        @media (max-width: 900px) {
          .landing-header {
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-md);
          }

          .landing-header__brand {
            width: 100%;
            justify-content: space-between;
          }

          .landing-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .feature-card__expanded {
            grid-template-columns: 1fr;
          }

          .comparison-shell {
            grid-template-columns: 1fr;
          }

          .comparison-divider {
            display: none;
          }

          .contact-card {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .landing-header {
            padding: var(--space-md);
          }

          .landing-header__brand {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--space-sm);
          }

          .landing-nav {
            display: none;
          }

          .landing-actions {
            display: none;
          }

          .hero-title {
            font-size: 2rem;
          }

          .hero-subtitle {
            font-size: 1rem;
          }

          .hero-stage__content {
            padding: 0;
            max-width: 100%;
          }

          .hero {
            padding: var(--space-md) 0;
          }

          .features-grid {
            grid-template-columns: 1fr;
          }

          .hero-stage {
            aspect-ratio: auto;
            min-height: 70vh;
            padding: var(--space-lg) var(--space-md);
          }

          .hero-actions {
            flex-direction: column;
            width: 100%;
          }

          .hero-cta {
            width: 100%;
            justify-content: center;
          }

          .benefits-rail {
            grid-template-columns: 1fr;
          }

          .comparison {
            padding: var(--space-xl) var(--space-md);
          }

          .contact-actions {
            width: 100%;
            grid-template-columns: 1fr;
            align-items: stretch;
          }

          .contact-actions .btn {
            width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .benefits-rail::before {
            animation: none;
          }

          .reveal-on-scroll {
            opacity: 1;
            transform: none;
            transition: none;
          }

          .benefit-item {
            transition: none;
          }

          .benefit-item::after {
            transition: none;
          }

          .comparison-panel {
            transition: none;
          }

          .cta-button {
            animation: none;
          }

          .cta-button:hover::before {
            animation: none;
          }
        }

      `}</style>
    </div>
  );
};

export default Landing;
