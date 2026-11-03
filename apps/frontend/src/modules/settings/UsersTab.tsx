import { useState } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser, type AppUser } from '@/api/settings'
import { useAuthStore } from '@/store/authStore'
import { Role } from '@/api/settings'

const ROLE_LABELS: Record<Role, string> = {
  [Role.OWNER]: 'Владелец', [Role.ADMIN]: 'Администратор',
  [Role.USER]: 'Пользователь', [Role.GUEST]: 'Гость',
}
const ROLE_COLORS: Record<Role, string> = {
  [Role.OWNER]: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  [Role.ADMIN]: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  [Role.USER]: 'bg-slate-500/20 text-slate-300 border border-slate-500/30',
  [Role.GUEST]: 'bg-green-500/20 text-green-300 border border-green-500/30',
}

interface UserForm { login: string; password: string; firstName: string; lastName: string; middleName: string; role: Role }

export default function UsersTab() {
  const { data: users = [] } = useUsers()
  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const currentUser = useAuthStore(s => s.user)
  const [editing, setEditing] = useState<AppUser | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<UserForm>({ login: '', password: '', firstName: '', lastName: '', middleName: '', role: Role.USER })

  function openCreate() {
    setForm({ login: '', password: '', firstName: '', lastName: '', middleName: '', role: Role.USER })
    setCreating(true)
  }

  function openEdit(u: AppUser) {
    setForm({ login: u.login, password: '', firstName: u.firstName, lastName: u.lastName, middleName: u.middleName || '', role: u.role })
    setEditing(u)
  }

  async function handleSave() {
    if (editing) {
      const data: Record<string, unknown> = { firstName: form.firstName, lastName: form.lastName, middleName: form.middleName, role: form.role }
      if (form.password) data.password = form.password
      await updateUser.mutateAsync({ id: editing.id, ...data } as never)
      setEditing(null)
    } else {
      await createUser.mutateAsync(form)
      setCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus size={15} className="mr-1" />Добавить пользователя</Button>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">ФИО</th>
              <th className="text-left px-4 py-2 font-medium">Логин</th>
              <th className="text-left px-4 py-2 font-medium">Роль</th>
              <th className="text-left px-4 py-2 font-medium">Статус</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-2 font-medium">{u.lastName} {u.firstName} {u.middleName}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{u.login}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="px-4 py-2">
                  <span className={`text-xs ${u.isActive ? 'text-green-400' : 'text-muted-foreground'}`}>
                    {u.isActive ? 'Активен' : 'Отключён'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-1 justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(u)}><Pencil size={14} /></Button>
                    {u.id !== currentUser?.id && u.role !== Role.OWNER && (
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive"
                        onClick={() => { if (confirm('Удалить пользователя?')) deleteUser.mutate(u.id) }}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(creating || editing) && (
        <Dialog open onOpenChange={() => { setCreating(false); setEditing(null) }}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? 'Редактировать пользователя' : 'Новый пользователь'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">Фамилия *</label>
                  <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Имя *</label>
                  <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Отчество</label>
                  <Input value={form.middleName} onChange={e => setForm(f => ({ ...f, middleName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Логин *</label>
                <Input value={form.login} onChange={e => setForm(f => ({ ...f, login: e.target.value }))} disabled={!!editing} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">{editing ? 'Новый пароль (оставьте пустым чтобы не менять)' : 'Пароль *'}</label>
                <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Роль</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {Object.values(Role).filter(r => r !== Role.OWNER).map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setCreating(false); setEditing(null) }}>Отмена</Button>
                <Button onClick={handleSave} disabled={createUser.isPending || updateUser.isPending}>Сохранить</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
