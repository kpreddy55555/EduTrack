'use client'

import { useState, Component, ReactNode } from 'react'
import dynamic from 'next/dynamic'

// Error Boundary to catch component crashes
class TabErrorBoundary extends Component<{ children: ReactNode; tabName: string }, { hasError: boolean; error: string }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  componentDidCatch(error: Error) {
    console.error(`[${this.props.tabName}] Error:`, error)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-xl font-bold text-red-400 mb-2">{this.props.tabName} - Load Error</h3>
          <p className="text-slate-400 mb-2 text-sm">{this.state.error}</p>
          <p className="text-xs text-slate-500 mb-4">Check browser console for details. Try running UPGRADE_V5.sql if tables are missing.</p>
          <button onClick={() => this.setState({ hasError: false, error: '' })}
            className="px-6 py-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30">
            🔄 Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const TabLoading = () => (
  <div className="flex items-center justify-center py-12">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-400"></div>
  </div>
)

// Dynamic imports prevent one crashed component from breaking others
const InstitutionSettings = dynamic(() => import('./components/InstitutionSettings'), { loading: TabLoading, ssr: false })
const AcademicYearManagement = dynamic(() => import('./components/AcademicYearManagement'), { loading: TabLoading, ssr: false })
const StandardsStreams = dynamic(() => import('./components/StandardsStreams'), { loading: TabLoading, ssr: false })
const DivisionManagement = dynamic(() => import('./components/DivisionManagement'), { loading: TabLoading, ssr: false })
const SubjectManagement = dynamic(() => import('./components/SubjectManagement'), { loading: TabLoading, ssr: false })
const FacultyAssignments = dynamic(() => import('./components/FacultyAssignments'), { loading: TabLoading, ssr: false })
const SubjectAllocation = dynamic(() => import('./components/SubjectAllocation'), { loading: TabLoading, ssr: false })
const TopicManagement = dynamic(() => import('./components/TopicManagement'), { loading: TabLoading, ssr: false })
const MilestoneManagement = dynamic(() => import('./components/MilestoneManagement'), { loading: TabLoading, ssr: false })
const StudentManagement = dynamic(() => import('./components/StudentManagement'), { loading: TabLoading, ssr: false })
const BulkUpload = dynamic(() => import('./components/BulkUpload'), { loading: TabLoading, ssr: false })

type TabType = 'institution' | 'academic-year' | 'standards' | 'divisions' | 'subjects' | 'subject-allocation' | 'topics' | 'milestones' | 'assignments' | 'students' | 'bulk-upload'

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('institution')

  const tabs = [
    { id: 'institution' as TabType, name: 'Institution', icon: '🏫', description: 'Board & Institution Info' },
    { id: 'academic-year' as TabType, name: 'Academic Year', icon: '📅', description: 'Year Management' },
    { id: 'standards' as TabType, name: 'Standards & Streams', icon: '🎓', description: 'XI, XII, Science, Commerce' },
    { id: 'divisions' as TabType, name: 'Divisions', icon: '📚', description: 'XII SCI A, XI COM B' },
    { id: 'subjects' as TabType, name: 'Subjects', icon: '📖', description: 'Math, Physics, Biology' },
    { id: 'subject-allocation' as TabType, name: 'Subject Allocation', icon: '📋', description: 'Assign Subjects to Divisions' },
    { id: 'topics' as TabType, name: 'Topics', icon: '📝', description: 'Syllabus Topics & Hours' },
    { id: 'milestones' as TabType, name: 'Milestones', icon: '🎯', description: 'Exam & Monthly Targets' },
    { id: 'assignments' as TabType, name: 'Faculty Assignments', icon: '👨‍🏫', description: 'Assign Subjects to Teachers' },
    { id: 'students' as TabType, name: 'Students', icon: '👨‍🎓', description: 'Student Records & Enrollment' },
    { id: 'bulk-upload' as TabType, name: 'Bulk Upload', icon: '📤', description: 'Excel Import' },
  ]

  const renderTab = () => {
    switch (activeTab) {
      case 'institution': return <InstitutionSettings />
      case 'academic-year': return <AcademicYearManagement />
      case 'standards': return <StandardsStreams />
      case 'divisions': return <DivisionManagement />
      case 'subjects': return <SubjectManagement />
      case 'subject-allocation': return <SubjectAllocation />
      case 'topics': return <TopicManagement />
      case 'milestones': return <MilestoneManagement />
      case 'assignments': return <FacultyAssignments />
      case 'students': return <StudentManagement />
      case 'bulk-upload': return <BulkUpload />
      default: return <InstitutionSettings />
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl">⚙️</span>
              <h1 className="text-3xl font-bold text-white">System Setup</h1>
            </div>
            <p className="text-slate-400">Manage institution, academic structure, students, and syllabus</p>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`p-4 rounded-xl border transition-all text-left ${
                  activeTab === tab.id
                    ? 'bg-amber-500/20 border-amber-500/50 text-white'
                    : 'bg-slate-700/30 border-white/10 text-slate-300 hover:bg-slate-700/50'
                }`}
              >
                <div className="text-2xl mb-2">{tab.icon}</div>
                <div className="font-semibold text-sm mb-1">{tab.name}</div>
                <div className="text-xs text-slate-400">{tab.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
          <TabErrorBoundary key={activeTab} tabName={tabs.find(t => t.id === activeTab)?.name || activeTab}>
            {renderTab()}
          </TabErrorBoundary>
        </div>
      </div>
    </div>
  )
}
