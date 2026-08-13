import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { RequireAuth, RequirePermission } from "@/components/RouteGuards";
import { useAuth } from "@/context/AuthContext";
import { AuditLogPage } from "@/pages/AuditLogPage";
import { ChangePasswordPage } from "@/pages/ChangePasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { ImportPage } from "@/pages/import/ImportPage";
import { DeductionRulesPage } from "@/pages/master/DeductionRulesPage";
import { EmployeesPage } from "@/pages/master/EmployeesPage";
import { JobGradesPage } from "@/pages/master/JobGradesPage";
import { ProportionSchemesPage } from "@/pages/master/ProportionSchemesPage";
import { WorkUnitsPage } from "@/pages/master/WorkUnitsPage";
import { MyDashboardPage } from "@/pages/MyDashboardPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { PeriodDetailPage } from "@/pages/periods/PeriodDetailPage";
import { PeriodsPage } from "@/pages/periods/PeriodsPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { UsersPage } from "@/pages/UsersPage";

function HomeRedirect() {
  const { hasPermission } = useAuth();
  if (hasPermission("dashboard.management.read")) return <Navigate to="/dashboard" replace />;
  if (hasPermission("self.dashboard.read")) return <Navigate to="/my" replace />;
  return <Navigate to="/periods" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route
          path="/dashboard"
          element={
            <RequirePermission perms={["dashboard.management.read"]}>
              <DashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path="/my"
          element={
            <RequirePermission perms={["self.dashboard.read"]}>
              <MyDashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path="/periods"
          element={
            <RequirePermission perms={["workflow.read"]}>
              <PeriodsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/periods/:id"
          element={
            <RequirePermission perms={["workflow.read"]}>
              <PeriodDetailPage />
            </RequirePermission>
          }
        />
        <Route
          path="/import"
          element={
            <RequirePermission perms={["import.read"]}>
              <ImportPage />
            </RequirePermission>
          }
        />
        <Route
          path="/master/employees"
          element={
            <RequirePermission perms={["master.employee.read"]}>
              <EmployeesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/master/work-units"
          element={
            <RequirePermission perms={["master.work_unit.read"]}>
              <WorkUnitsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/master/proportion-schemes"
          element={
            <RequirePermission perms={["master.proportion_scheme.read"]}>
              <ProportionSchemesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/master/job-grades"
          element={
            <RequirePermission perms={["master.job_grade.read"]}>
              <JobGradesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/master/deduction-rules"
          element={
            <RequirePermission perms={["master.deduction_rule.read"]}>
              <DeductionRulesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/reports"
          element={
            <RequirePermission perms={["report.export"]}>
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/users"
          element={
            <RequirePermission perms={["user.read"]}>
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="/audit"
          element={
            <RequirePermission perms={["audit.read"]}>
              <AuditLogPage />
            </RequirePermission>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
