import { AuditLog } from "@/components/admin/AuditLog";
import { DictionaryEditor } from "@/components/admin/DictionaryEditor";
import { UserManagement } from "@/components/admin/UserManagement";

export const revalidate = 0;

export default async function AdminPage() {
  return (
    <main className="space-y-8 pb-12">
      <UserManagement />
      <DictionaryEditor />
      <AuditLog />
    </main>
  );
}
