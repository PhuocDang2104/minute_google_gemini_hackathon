import {
  Brain,
  Users,
  FileText,
  Mic,
  CheckCircle,
  Zap,
  Github,
  ExternalLink,
  Sparkles,
  Target,
  Lightbulb,
  Workflow,
  BarChart3,
  MessageSquare,
  Info,
  Map,
  BadgeDollarSign,
  Mail,
  LogIn,
  ShieldCheck,
  Layers,
  Cloud,
  Database,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import FloatingNavbar from '../../components/ui/floating-navbar'
import ContactEmailForm from '../../components/ui/contact-email-form'

const SECTION_NAV = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'problem', label: 'Vấn đề' },
  { id: 'solution', label: 'Giải pháp' },
  { id: 'goals', label: 'Mục tiêu' },
  { id: 'architecture', label: 'SAAR AI' },
  { id: 'system-architecture', label: 'Kiến trúc' },
  { id: 'ai-stack', label: 'AI Stack' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'deployment', label: 'Triển khai' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'team', label: 'Team' },
  { id: 'contact', label: 'Liên hệ' },
]

const About = () => {
  const [activeSection, setActiveSection] = useState(SECTION_NAV[0]?.id ?? 'overview')

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId)
    if (!section) return
    section.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(sectionId)
  }

  useEffect(() => {
    const targets = SECTION_NAV.map((item) => document.getElementById(item.id)).filter(
      (section): section is HTMLElement => Boolean(section),
    )

    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          setActiveSection(entry.target.id)
        })
      },
      { threshold: 0.25, rootMargin: '-20% 0px -60% 0px' },
    )

    targets.forEach((target) => observer.observe(target))

    return () => observer.disconnect()
  }, [])

  return (
    <div className="about-page public-page">
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

      <div className="about-container">
        <section className="about-hero" id="overview">
          <div className="about-hero__content">
            <div className="about-hero__badge">
              <Sparkles size={16} />
              VNPT AI Hackathon 2025 | Track 1
            </div>
            <h1 className="about-hero__title">
              <span className="about-hero__logo">Meet</span>
              <span className="about-hero__logo about-hero__logo--accent">Mate</span>
            </h1>
            <p className="about-hero__tagline">
              Agentic S/CRAG AI Meeting Co-Host for BFSI
            </p>
            <p className="about-hero__description">
              Minute chuẩn hóa vòng đời cuộc họp cho doanh nghiệp BFSI/LPBank: thu thập ngữ cảnh trước họp,
              hỗ trợ realtime trong họp, phát hành biên bản và action items sau họp - tất cả có trích dẫn,
              audit và kiểm soát quyền truy cập.
            </p>
            <div className="about-hero__actions">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => scrollToSection('solution')}
              >
                Xem giải pháp
              </button>
              <Link to="/roadmap" className="btn btn-outline btn-lg">Lộ trình sản phẩm</Link>
            </div>
            <div className="about-hero__metrics">
              <div className="about-metric">
                <span className="about-metric__label">Stage-aware router</span>
                <span className="about-metric__value">Pre / In / Post</span>
              </div>
              <div className="about-metric">
                <span className="about-metric__label">Realtime pipeline</span>
                <span className="about-metric__value">Audio WS - STT - Live recap</span>
              </div>
              <div className="about-metric">
                <span className="about-metric__label">RAG permission-aware</span>
                <span className="about-metric__value">pgvector + ACL filter</span>
              </div>
              <div className="about-metric">
                <span className="about-metric__label">Audit-ready</span>
                <span className="about-metric__value">Citations + log + replay</span>
              </div>
            </div>
          </div>
          <div className="about-hero__visual">
            <img
              src="/minute_ai.png"
              alt="Minute product preview"
              className="about-hero__image"
              loading="lazy"
            />
            <div className="about-hero__visual-note">
              Desktop app + meeting add-in concept, tối ưu cho enterprise PMO.
            </div>
          </div>
        </section>

        <nav className="about-nav" aria-label="Điều hướng trang giới thiệu">
          {SECTION_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`about-nav__link${activeSection === item.id ? ' is-active' : ''}`}
              aria-current={activeSection === item.id ? 'true' : undefined}
              onClick={() => scrollToSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <section className="about-section about-section--no-border">
          <div className="about-section__header">
            <Sparkles size={24} />
            <h2>Điểm nổi bật cốt lõi</h2>
          </div>

          <div className="about-grid about-grid--4 about-grid--highlights">
            <div className="about-ai-card">
              <Workflow size={24} />
              <h4>Stage-aware Assistant</h4>
              <p>LangGraph router điều phối Pre/In/Post theo bối cảnh, SLA và độ nhạy dữ liệu.</p>
            </div>

            <div className="about-ai-card">
              <Zap size={24} />
              <h4>Realtime Pipeline</h4>
              <p>Audio WS - SmartVoice STT - session bus - live transcript/recap/ADR trên UI.</p>
            </div>

            <div className="about-ai-card">
              <Database size={24} />
              <h4>RAG Permission-aware</h4>
              <p>pgvector + metadata filter, nguyên tắc no-source-no-answer.</p>
            </div>

            <div className="about-ai-card">
              <ShieldCheck size={24} />
              <h4>Audit & Governance</h4>
              <p>Structured outputs, citations, log & replay theo meeting_id.</p>
            </div>
          </div>
        </section>

        <section className="about-section" id="problem">
          <div className="about-section__header">
            <Target size={24} />
            <h2>Vấn đề & Giải pháp</h2>
          </div>

          <div className="about-grid about-grid--2">
            <div className="about-card about-card--problem about-card--accent">
              <h3>Vấn đề hiện tại</h3>
              <ul>
                <li>Biên bản họp ghi thủ công, phát hành chậm và dễ sai sót.</li>
                <li>Người họp vừa lắng nghe vừa ghi chép, dễ bỏ sót quyết định quan trọng.</li>
                <li>Tài liệu rải rác (SharePoint/OneDrive/email/wiki) khó tra cứu khi đang họp.</li>
                <li>Action items thiếu owner, deadline; follow-up rời rạc.</li>
                <li>Yêu cầu bảo mật và kiểm toán cao trong môi trường BFSI.</li>
              </ul>
            </div>

            <div className="about-card about-card--solution about-card--accent">
              <h3>Giải pháp Minute</h3>
              <ul>
                <li>AI tự động tạo agenda & pre-read theo ngữ cảnh dự án.</li>
                <li>Live transcript, live recap và ADR (Actions/Decisions/Risks).</li>
                <li>RAG Q&A có citations và kiểm soát truy cập tài liệu.</li>
                <li>Tạo biên bản chuẩn BFSI, sync tasks sang Jira/Planner.</li>
                <li>Audit-ready: log, versioning và policy tuân thủ.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="about-section about-section--features" id="solution">
          <div className="about-section__header">
            <Workflow size={24} />
            <h2>Solution Overview (Pre/In/Post)</h2>
          </div>

          <div className="about-grid about-grid--3">
            <div className="about-feature about-feature--pre">
              <div className="about-feature__icon about-feature__icon--pre">
                <FileText size={28} />
              </div>
              <h3>Pre-Meeting</h3>
              <p className="about-feature__summary">Chuẩn bị agenda và pre-read theo ngữ cảnh.</p>
              <ul>
                <li>Agenda + pre-read pack theo lịch và chủ đề</li>
                <li>Gợi ý câu hỏi trọng tâm trước họp</li>
                <li>Chọn đúng policy/proposal/biên bản liên quan</li>
                <li>Đề xuất người tham gia theo vai trò</li>
              </ul>
            </div>

            <div className="about-feature about-feature--in">
              <div className="about-feature__icon about-feature__icon--in">
                <Mic size={28} />
              </div>
              <h3>In-Meeting</h3>
              <p className="about-feature__summary">Co-host realtime, ghi chép và phân tích liên tục.</p>
              <ul>
                <li>Live transcript + recap theo timeline</li>
                <li>Auto-detect Actions/Decisions/Risks</li>
                <li>Ask AI dựa trên tài liệu nội bộ</li>
                <li>Tool suggestions: task, schedule, attach docs</li>
              </ul>
            </div>

            <div className="about-feature about-feature--post">
              <div className="about-feature__icon about-feature__icon--post">
                <CheckCircle size={28} />
              </div>
              <h3>Post-Meeting</h3>
              <p className="about-feature__summary">Tổng hợp, chuẩn hóa biên bản và follow-up.</p>
              <ul>
                <li>Executive summary + MoM + highlights</li>
                <li>Sync tasks với Jira/Planner/Work</li>
                <li>Archive biên bản có citations & timecode</li>
                <li>Tra cứu quyết định theo meeting/project</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="about-section" id="goals">
          <div className="about-section__header">
            <Lightbulb size={24} />
            <h2>Product Goals & Target Users</h2>
          </div>

          <div className="about-grid about-grid--2">
            <div className="about-card about-card--goal">
              <h3>Product Goals</h3>
              <ul>
                <li>Product-ready: Pre/In/Post end-to-end, realtime co-host.</li>
                <li>RAG có trích dẫn, audit-ready cho môi trường BFSI.</li>
                <li>Mở rộng multi-workspace, policy theo đơn vị.</li>
                <li>Phân tích xu hướng họp và organizational memory.</li>
              </ul>
            </div>

            <div className="about-card about-card--persona">
              <h3>Target Users</h3>
              <ul>
                <li>Doanh nghiệp lớn/BFSI, enterprise PMO.</li>
                <li>Khối công nghệ, vận hành, pháp chế, rủi ro.</li>
                <li>Đơn vị cần audit/tuân thủ cao.</li>
                <li>Nhóm điều hành cần ra quyết định nhanh, rõ ràng.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="about-section" id="architecture">
          <div className="about-section__header">
            <Brain size={24} />
            <h2>SAAR AI Architecture</h2>
          </div>

          <div className="about-grid about-grid--2">
            <div className="about-card about-card--accent">
              <h3>SAAR (Self-aware Adaptive Agentic RAG)</h3>
              <ul>
                <li>Stage-aware routing: điều phối theo stage, SLA, sensitivity.</li>
                <li>Shared MeetingState xuyên suốt agenda/transcript/ADR.</li>
                <li>RAG-first + graded retrieval, bắt buộc citations.</li>
                <li>Self-reflect loop để kiểm tra và bổ sung context.</li>
                <li>Tool-calling schema-based, có UI confirm & audit log.</li>
              </ul>
            </div>

            <figure className="about-media">
              <img
                src="/docs/assets/saar-architecture.png"
                alt="SAAR AI architecture diagram"
                loading="lazy"
              />
              <figcaption>SAAR: router Pre/In/Post, RAG-first, audit-ready.</figcaption>
            </figure>
          </div>
        </section>

        <section className="about-section" id="system-architecture">
          <div className="about-section__header">
            <Layers size={24} />
            <h2>System Architecture & Tech Stack</h2>
          </div>

          <div className="about-architecture">
            <div className="about-arch-layer">
              <h4>Client Layer</h4>
              <div className="about-tech-tags">
                <span className="about-tech-tag">Electron</span>
                <span className="about-tech-tag">Vite</span>
                <span className="about-tech-tag">React 18</span>
                <span className="about-tech-tag">TypeScript</span>
                <span className="about-tech-tag">Teams Add-in</span>
              </div>
            </div>

            <div className="about-arch-layer">
              <h4>Communication</h4>
              <div className="about-tech-tags">
                <span className="about-tech-tag">WebSocket</span>
                <span className="about-tech-tag">gRPC Audio</span>
                <span className="about-tech-tag">REST APIs</span>
                <span className="about-tech-tag">Event Bus</span>
              </div>
            </div>

            <div className="about-arch-layer">
              <h4>Backend Core</h4>
              <div className="about-tech-tags">
                <span className="about-tech-tag">FastAPI</span>
                <span className="about-tech-tag">Uvicorn</span>
                <span className="about-tech-tag">SQLAlchemy</span>
                <span className="about-tech-tag">PostgreSQL</span>
              </div>
            </div>

            <div className="about-arch-layer">
              <h4>AI/ML Layer</h4>
              <div className="about-tech-tags">
                <span className="about-tech-tag about-tech-tag--ai">LangChain</span>
                <span className="about-tech-tag about-tech-tag--ai">LangGraph</span>
                <span className="about-tech-tag about-tech-tag--ai">LLM</span>
                <span className="about-tech-tag about-tech-tag--ai">SmartVoice</span>
                <span className="about-tech-tag about-tech-tag--ai">pgvector</span>
              </div>
            </div>

            <div className="about-arch-layer">
              <h4>Deployment & Security</h4>
              <div className="about-tech-tags">
                <span className="about-tech-tag">Docker Compose</span>
                <span className="about-tech-tag">VPC/On-prem</span>
                <span className="about-tech-tag">RBAC/ABAC</span>
                <span className="about-tech-tag">Audit & Retention</span>
              </div>
            </div>
          </div>

          <div className="about-card about-card--stack">
            <h3>Tech Stack nổi bật</h3>
            <div className="about-tech-tags">
              <span className="about-tech-tag">Electron + Vite</span>
              <span className="about-tech-tag">React + TypeScript</span>
              <span className="about-tech-tag">FastAPI + WebSocket</span>
              <span className="about-tech-tag">PostgreSQL + pgvector</span>
              <span className="about-tech-tag">LangChain + LangGraph</span>
              <span className="about-tech-tag">SmartVoice STT</span>
              <span className="about-tech-tag">Docker Compose</span>
            </div>
          </div>

          <div className="about-media-grid">
            <figure className="about-media">
              <img
                src="/docs/assets/system-architecture-4-layers.png"
                alt="System architecture layers"
                loading="lazy"
              />
              <figcaption>System Architecture (multi-layer).</figcaption>
            </figure>
            <figure className="about-media">
              <img
                src="/docs/assets/architecture.png"
                alt="System architecture diagram"
                loading="lazy"
              />
              <figcaption>Realtime pipeline & service topology.</figcaption>
            </figure>
          </div>
        </section>

        <section className="about-section about-section--ai" id="ai-stack">
          <div className="about-section__header">
            <Sparkles size={24} />
            <h2>AI Components (VNPT Platform)</h2>
          </div>

          <div className="about-grid about-grid--4 about-grid--ai">
            <div className="about-ai-card about-ai-card--tone">
              <Mic size={24} />
              <h4>SmartVoice</h4>
              <p>Streaming STT vi/en, diarization hooks cho meeting realtime.</p>
            </div>

            <div className="about-ai-card about-ai-card--tone">
              <MessageSquare size={24} />
              <h4>SmartBot</h4>
              <p>Intent routing, recap, ADR extraction, tool-calling.</p>
            </div>

            <div className="about-ai-card about-ai-card--tone">
              <FileText size={24} />
              <h4>SmartReader</h4>
              <p>OCR + text extraction, ingest tài liệu vào Knowledge Hub.</p>
            </div>

            <div className="about-ai-card about-ai-card--tone">
              <Workflow size={24} />
              <h4>SmartUX</h4>
              <p>Thu thập UX metrics phục vụ tối ưu trải nghiệm người dùng.</p>
            </div>
          </div>
          <p className="about-section__note">
            Optional modules: sentiment/insights, voice verification, vnSocial cho marketing use case.
          </p>
        </section>

        <section className="about-section" id="compliance">
          <div className="about-section__header">
            <ShieldCheck size={24} />
            <h2>Key Capabilities & Security</h2>
          </div>

          <div className="about-grid about-grid--2">
            <div className="about-card about-card--capabilities">
              <h3>Key Capabilities</h3>
              <ul>
                <li>Realtime WS flow: session → audio WS → frontend WS.</li>
                <li>Live recap + topic segmentation + ADR extraction.</li>
                <li>Knowledge Hub: upload → chunk → embed → Q&A.</li>
                <li>Tool suggestions: create task, schedule, attach docs.</li>
                <li>Compliance-ready: citations, timecode, versioning.</li>
              </ul>
            </div>

            <div className="about-card about-card--security">
              <h3>Security & Compliance</h3>
              <ul>
                <li>PII masking/tokenization trước khi gọi external LLM.</li>
                <li>Private link/VPC peering cho endpoint LLM.</li>
                <li>RBAC/ABAC theo phòng ban, ACL chặt cho RAG.</li>
                <li>Audit logs cho tool calls, RAG queries, state transitions.</li>
                <li>Retention & compliance archive theo policy.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="about-section about-section--kpi" id="kpi">
          <div className="about-section__header">
            <BarChart3 size={24} />
            <h2>Observability & KPIs</h2>
          </div>

          <div className="about-grid about-grid--4 about-grid--kpi">
            <div className="about-metric-card">
              <span className="about-metric-card__label">Latency</span>
              <h4>Realtime Performance</h4>
              <p>Realtime recap, WS tick scheduling, STT WER.</p>
            </div>

            <div className="about-metric-card">
              <span className="about-metric-card__label">Quality</span>
              <h4>ADR Accuracy</h4>
              <p>Precision/recall action items, ADR consistency.</p>
            </div>

            <div className="about-metric-card">
              <span className="about-metric-card__label">Usage</span>
              <h4>Adoption</h4>
              <p>Ask-AI per meeting, highlight views, Q&A usage.</p>
            </div>

            <div className="about-metric-card">
              <span className="about-metric-card__label">Cost</span>
              <h4>Token Efficiency</h4>
              <p>Token budget/meeting, cached glossary/FAQ.</p>
            </div>
          </div>
        </section>

        <section className="about-section" id="deployment">
          <div className="about-section__header">
            <Cloud size={24} />
            <h2>Deployment & Ops</h2>
          </div>

          <div className="about-grid about-grid--3 about-grid--steps">
            <div className="about-card about-card--step">
              <h3>Local Dev</h3>
              <ul>
                <li>Docker Compose: backend + Postgres.</li>
                <li>Seed data sẵn cho demo PMO LPBank.</li>
                <li>Electron UI kết nối qua VITE_API_URL.</li>
              </ul>
            </div>

            <div className="about-card about-card--step">
              <h3>MVP Cloud</h3>
              <ul>
                <li>Supabase + Render + Vercel (prototype).</li>
                <li>CI/CD nhanh, phù hợp giai đoạn thử nghiệm.</li>
                <li>Quan sát hiệu năng qua metrics dashboard.</li>
              </ul>
            </div>

            <div className="about-card about-card--step">
              <h3>Production</h3>
              <ul>
                <li>Private VPC/on-prem, WORM storage.</li>
                <li>Audit + retention theo policy BFSI.</li>
                <li>HA, backup, disaster recovery.</li>
              </ul>
            </div>
          </div>

          <figure className="about-media about-media--wide">
            <img
              src="/docs/assets/deployment.png"
              alt="Deployment architecture"
              loading="lazy"
            />
            <figcaption>Deployment architecture for enterprise rollout.</figcaption>
          </figure>
        </section>

        <section className="about-section" id="docs">
          <div className="about-section__header">
            <FileText size={24} />
            <h2>Docs & Artifacts</h2>
          </div>

          <div className="about-grid about-grid--2 about-grid--docs">
            <div className="about-card about-card--docs">
              <h3>Architecture & AI</h3>
              <ul>
                <li><code>docs/Minute _ SAAR – Self-aware Adaptive Agentic RAG.md</code></li>
                <li><code>docs/rag_architecture.md</code></li>
                <li><code>docs/AI architecture/</code></li>
                <li><code>docs/in_meeting_flow.md</code></li>
              </ul>
            </div>

            <div className="about-card about-card--docs">
              <h3>API & Ops</h3>
              <ul>
                <li><code>docs/api_contracts.md</code></li>
                <li><code>docs/real_time_transcript.md</code></li>
                <li><code>docs/transcript_ingest_api.md</code></li>
                <li><code>docs/DEPLOYMENT.md</code></li>
              </ul>
            </div>
          </div>
        </section>

        <section className="about-section about-section--roadmap" id="roadmap">
          <div className="about-section__header">
            <Map size={24} />
            <h2>Roadmap</h2>
          </div>

          <div className="about-roadmap about-roadmap--timeline">
            <article className="about-roadmap__item">
              <span className="about-roadmap__phase">GĐ0</span>
              <h3>Realtime Meeting Core</h3>
              <ul className="about-roadmap__list">
                <li>Join meeting + realtime ASR + live recap.</li>
                <li>Post-meeting summary & highlights.</li>
              </ul>
            </article>

            <article className="about-roadmap__item">
              <span className="about-roadmap__phase">GĐ1</span>
              <h3>Action & RAG Foundation</h3>
              <ul className="about-roadmap__list">
                <li>Action/Decision extractor + task sync.</li>
                <li>Internal RAG + knowledge hub.</li>
              </ul>
            </article>

            <article className="about-roadmap__item">
              <span className="about-roadmap__phase">GĐ2</span>
              <h3>Compliance & Quality</h3>
              <ul className="about-roadmap__list">
                <li>Guardrails/compliance archive.</li>
                <li>Quality dashboard + highlights.</li>
              </ul>
            </article>

            <article className="about-roadmap__item">
              <span className="about-roadmap__phase">GĐ3</span>
              <h3>Org-level Intelligence</h3>
              <ul className="about-roadmap__list">
                <li>Analytics đa cấp, cross-meeting insights.</li>
                <li>Multi-channel assistant (desktop/web/room).</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="about-section" id="demo">
          <div className="about-section__header">
            <Zap size={24} />
            <h2>Demo Scenarios</h2>
          </div>

          <div className="about-demo-list about-demo-list--modern">
            <div className="about-demo-item">
              <span className="about-demo-number">1</span>
              <div>
                <h4>Steering Committee Prep</h4>
                <p>AI đề xuất agenda, tài liệu pre-read, và danh sách người tham gia.</p>
              </div>
            </div>

            <div className="about-demo-item">
              <span className="about-demo-number">2</span>
              <div>
                <h4>Live Meeting với AI Co-host</h4>
                <p>Realtime transcript, ADR detection, Ask AI với policy nội bộ.</p>
              </div>
            </div>

            <div className="about-demo-item">
              <span className="about-demo-number">3</span>
              <div>
                <h4>Minutes & Follow-up</h4>
                <p>1-click generate MoM, export, sync tasks và compliance archive.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="about-section about-section--team" id="team">
          <div className="about-section__header">
            <Users size={24} />
            <h2>Đội ngũ phát triển</h2>
          </div>

          <div className="about-team-grid about-team-grid--accent">
            <div className="about-team-member">
              <div className="about-team-avatar">
                <Users size={32} />
              </div>
              <h4>Đặng Như Phước</h4>
              <p>Leader | Backend/AI Engineer, realtime WS pipeline, LangGraph & RAG.</p>
            </div>

            <div className="about-team-member">
              <div className="about-team-avatar">
                <Users size={32} />
              </div>
              <h4>Thái Hoài An</h4>
              <p>Data Engineer | Schema, pgvector, ingest tài liệu, seed/demo data.</p>
            </div>

            <div className="about-team-member">
              <div className="about-team-avatar">
                <Users size={32} />
              </div>
              <h4>Trương Minh Đạt</h4>
              <p>BA & GTM Analyst | BFSI requirements, KPIs, go-to-market.</p>
            </div>

            <div className="about-team-member">
              <div className="about-team-avatar">
                <Users size={32} />
              </div>
              <h4>Hoàng Minh Quân</h4>
              <p>End-user Analyst | UX research, deployment plan, rollout support.</p>
            </div>
          </div>
        </section>

        <section className="about-section" id="mentors">
          <div className="about-section__header">
            <Lightbulb size={24} />
            <h2>Mentor Acknowledgements</h2>
          </div>

          <div className="about-grid about-grid--2 about-grid--mentors">
            <div className="about-card about-card--mentor">
              <h3>Hồ Minh Nghĩa</h3>
              <ul>
                <li>Chuyên gia AI/GenAI, tư vấn kiến trúc & bảo mật.</li>
                <li>Định hướng tính khả thi triển khai BFSI.</li>
              </ul>
            </div>

            <div className="about-card about-card--mentor">
              <h3>Nguyễn Phan Khoa Đức</h3>
              <ul>
                <li>Giám đốc phát triển công nghệ AI tại VNPT AI.</li>
                <li>Cố vấn hướng công nghệ và sản phẩm.</li>
              </ul>
            </div>

            <div className="about-card about-card--mentor">
              <h3>Lâm Vũ Dương</h3>
              <ul>
                <li>Giám đốc VNPT, hỗ trợ kết nối & định hướng chương trình.</li>
                <li>Đảm bảo alignment với chiến lược doanh nghiệp.</li>
              </ul>
            </div>

            <div className="about-card about-card--mentor">
              <h3>Thành Đạt</h3>
              <ul>
                <li>VNPT GoMeet Software Engineer, hỗ trợ tích hợp nền tảng họp.</li>
                <li>Tư vấn kỹ thuật cho meeting add-in/bot.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

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

export default About
