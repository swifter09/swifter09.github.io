import { AdminDashboard } from "./admin-dashboard";

export const metadata = {
  title: "作者后台｜字节漫游",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <AdminDashboard />;
}
