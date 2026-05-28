import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from 'sonner'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import AppLayout from '@/components/layout/AppLayout.jsx';

// Welcome / Login
import Welcome from '@/pages/Welcome';

// Main pages
import Dashboard from '@/pages/Dashboard';
import PersonnelHub from '@/pages/personnel/PersonnelHub';
import Plans from '@/pages/Plans';
import PlanDetail from '@/pages/PlanDetail';
import PreventiveMaint from '@/pages/PreventiveMaint';
import WorkOrders from '@/pages/WorkOrders';
import WorkOrderDetail from '@/pages/WorkOrderDetail.jsx';
import GanttChartPage from '@/pages/GanttChart.jsx';
import Inventory from '@/pages/Inventory';
import ReportsHub from '@/pages/reports/ReportsHub';
import AnalyticsDashboard from '@/pages/AnalyticsDashboard';
import UsersModule from '@/pages/UsersModule';
import Settings from '@/pages/Settings';
import KPIsDashboard from '@/pages/KPIsDashboard';
import Services from '@/pages/Services';

// Hierarchy pages
import Companies from '@/pages/hierarchy/Companies';
import Sites from '@/pages/hierarchy/Sites';
import BusinessUnits from '@/pages/hierarchy/BusinessUnits';
import Locations from '@/pages/hierarchy/Locations';
import Processes from '@/pages/hierarchy/Processes';
import Assets from '@/pages/hierarchy/Assets';
import Systems from '@/pages/hierarchy/Systems';
import Components from '@/pages/hierarchy/Components';
import SpareParts from '@/pages/hierarchy/SpareParts';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      return <Welcome />;
    }
  }

  return (
    <Routes>
      {/* Public welcome/login screen */}
      <Route path="/welcome" element={<Welcome />} />

      <Route element={<AppLayout />}>
        {/* Dashboard */}
        <Route path="/" element={<Dashboard />} />

        {/* Personnel */}
        <Route path="/personnel" element={<PersonnelHub />} />

        {/* Maintenance */}
        <Route path="/plans" element={<Plans />} />
        <Route path="/plans/:id" element={<PlanDetail />} />
        <Route path="/preventive" element={<PreventiveMaint />} />
        <Route path="/work-orders" element={<WorkOrders />} />
        <Route path="/work-orders/:id" element={<WorkOrderDetail />} />
        <Route path="/gantt" element={<GanttChartPage />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/services" element={<Services />} />
        <Route path="/reports" element={<ReportsHub />} />
        <Route path="/analytics" element={<AnalyticsDashboard />} />
        <Route path="/users" element={<UsersModule />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/kpis" element={<KPIsDashboard />} />

        {/* 9-level Hierarchy */}
        <Route path="/hierarchy/companies" element={<Companies />} />
        <Route path="/hierarchy/sites" element={<Sites />} />
        <Route path="/hierarchy/business-units" element={<BusinessUnits />} />
        <Route path="/hierarchy/locations" element={<Locations />} />
        <Route path="/hierarchy/processes" element={<Processes />} />
        <Route path="/hierarchy/assets" element={<Assets />} />
        <Route path="/hierarchy/systems" element={<Systems />} />
        <Route path="/hierarchy/components" element={<Components />} />
        <Route path="/hierarchy/spare-parts" element={<SpareParts />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App