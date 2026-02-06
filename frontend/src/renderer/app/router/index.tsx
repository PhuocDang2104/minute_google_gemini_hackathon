import { createHashRouter } from 'react-router-dom'
import AppShell from '../layout/AppShell'
import Dashboard from '../routes/Dashboard'
import Calendar from '../routes/Calendar'
import Meetings from '../routes/Meetings'
import MeetingIn from '../routes/Meetings/MeetingIn'
import MeetingPost from '../routes/Meetings/MeetingPost'
import MeetingDock from '../routes/Meetings/MeetingDock'
import MeetingCapture from '../routes/Meetings/MeetingCapture'
import KnowledgeHub from '../routes/KnowledgeHub'
import Projects from '../routes/Projects'
import ProjectDetail from '../routes/Projects/ProjectDetail'
import Tasks from '../routes/Tasks'
import Settings from '../routes/Settings'
import About from '../routes/About'
import Roadmap from '../routes/Roadmap'
import Pricing from '../routes/Pricing'
import MeetingLayout from '../layout/MeetingLayout'
import { MeetingDetail } from '../../features/meetings/components/MeetingDetail'
import Landing from '../routes/Landing'
import AdminConsole from '../routes/AdminConsole'
import TemplateManagement from '../routes/TemplateManagement'

const router = createHashRouter([
  // Public routes
  { path: '/', element: <Landing /> },
  { path: '/about', element: <About /> },
  { path: '/roadmap/*', element: <Roadmap /> },
  { path: '/pricing/*', element: <Pricing /> },

  // App routes (with shell) - No auth required
  {
    path: '/app',
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'calendar', element: <Calendar /> },
      {
        path: 'meetings',
        element: <Meetings />,
      },
      {
        path: 'projects',
        element: <Projects />,
      },
      {
        path: 'projects/:projectId',
        element: <ProjectDetail />,
      },
      {
        path: 'meetings/:meetingId/detail',
        element: <MeetingDetail />,
      },
      {
        path: 'meetings/:meetingId/dock',
        element: <MeetingDock />,
      },
      {
        path: 'meetings/:meetingId/capture',
        element: <MeetingCapture />,
      },
      {
        path: 'meetings/:meetingId',
        element: <MeetingLayout />,
        children: [
          // Removed pre-meeting - focus on in & post
          { path: 'in', element: <MeetingIn /> },
          { path: 'post', element: <MeetingPost /> },
        ],
      },
      // Removed projects routes
      { path: 'knowledge', element: <KnowledgeHub /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'settings', element: <Settings /> },
      { path: 'admin', element: <AdminConsole /> },
      { path: 'templates', element: <TemplateManagement /> },
    ],
  },
])

export default router
