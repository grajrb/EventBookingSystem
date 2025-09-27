import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { profileAPI } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { showApiError } from '@/lib/errors';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
const passwordSchema = z.object({
  currentPassword: z.string().min(6, 'Current password required'),
  newPassword: z.string()
    .min(8, 'At least 8 characters')
    .regex(PASSWORD_REGEX, 'Must include upper, lower, number & symbol'),
});
const emailSchema = z.object({
  password: z.string().min(6, 'Password required'),
  newEmail: z.string().email('Valid email required')
});
const deleteSchema = z.object({ password: z.string().min(6, 'Password required') });

type PasswordValues = z.infer<typeof passwordSchema>;
type EmailValues = z.infer<typeof emailSchema>;
type DeleteValues = z.infer<typeof deleteSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [openDelete, setOpenDelete] = useState(false);
  const queryClient = useQueryClient();

  const pwForm = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });
  const emForm = useForm<EmailValues>({ resolver: zodResolver(emailSchema) });
  const delForm = useForm<DeleteValues>({ resolver: zodResolver(deleteSchema) });

  const [pwLoading, setPwLoading] = useState(false);
  const [emLoading, setEmLoading] = useState(false);
  const [delLoading, setDelLoading] = useState(false);

  const submitPassword = pwForm.handleSubmit(async (values) => {
    setPwLoading(true);
    try {
      const res = await profileAPI.changePassword(values);
      if (res.data?.token) {
        localStorage.setItem('token', res.data.token);
        if (res.data.refreshToken) localStorage.setItem('refreshToken', res.data.refreshToken);
      }
      // Nothing to change in cached profile other than maybe security timestamp; omitted.
      toast({ title: 'Password updated' });
      pwForm.reset();
    } catch (e:any) {
      showApiError(toast, e, 'Failed to update password');
    } finally { setPwLoading(false); }
  });

  const submitEmail = emForm.handleSubmit(async (values) => {
    setEmLoading(true);
    try {
      const res = await profileAPI.changeEmail(values);
      if (res.data?.token) {
        localStorage.setItem('token', res.data.token);
        if (res.data.refreshToken) localStorage.setItem('refreshToken', res.data.refreshToken);
      }
      if (res.data?.user) {
        queryClient.setQueryData(['profile'], (old: any) => old ? { ...old, email: res.data.user.email } : old);
        queryClient.setQueryData(['auth','me'], (old: any) => old ? { ...old, email: res.data.user.email } : old);
      }
      toast({ title: 'Email updated' });
      emForm.reset();
    } catch (e:any) {
      showApiError(toast, e, 'Failed to update email');
    } finally { setEmLoading(false); }
  });

  const submitDelete = delForm.handleSubmit(async (values) => {
    setDelLoading(true);
    try {
      await profileAPI.deleteAccount(values);
      toast({ title: 'Account deleted' });
      logout();
    } catch (e:any) {
      showApiError(toast, e, 'Failed to delete account');
    } finally { setDelLoading(false); setOpenDelete(false); }
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-3xl mx-auto py-8 px-4">
        <h2 className="text-3xl font-bold mb-6">Settings</h2>
        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitPassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Current Password</label>
                  <Input type="password" {...pwForm.register('currentPassword')} />
                  {pwForm.formState.errors.currentPassword && <p className="text-xs text-red-600">{pwForm.formState.errors.currentPassword.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">New Password</label>
                  <Input type="password" {...pwForm.register('newPassword')} />
                  {pwForm.formState.errors.newPassword && <p className="text-xs text-red-600">{pwForm.formState.errors.newPassword.message}</p>}
                </div>
                <Button type="submit" disabled={pwLoading}>{pwLoading ? 'Updating...' : 'Update Password'}</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Change Email</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitEmail} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">New Email</label>
                  <Input type="email" {...emForm.register('newEmail')} />
                  {emForm.formState.errors.newEmail && <p className="text-xs text-red-600">{emForm.formState.errors.newEmail.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Password</label>
                  <Input type="password" {...emForm.register('password')} />
                  {emForm.formState.errors.password && <p className="text-xs text-red-600">{emForm.formState.errors.password.message}</p>}
                </div>
                <Button type="submit" disabled={emLoading}>{emLoading ? 'Updating...' : 'Update Email'}</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-red-300">
            <CardHeader><CardTitle className="text-red-700">Danger Zone</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm mb-4">Deleting your account is irreversible.</p>
              <Dialog open={openDelete} onOpenChange={setOpenDelete}>
                <DialogTrigger asChild>
                  <Button variant="destructive">Delete Account</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Confirm Deletion</DialogTitle></DialogHeader>
                  <form onSubmit={submitDelete} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Password</label>
                      <Input type="password" {...delForm.register('password')} />
                      {delForm.formState.errors.password && <p className="text-xs text-red-600">{delForm.formState.errors.password.message}</p>}
                    </div>
                    <DialogFooter className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={()=>setOpenDelete(false)}>Cancel</Button>
                      <Button type="submit" variant="destructive" disabled={delLoading}>{delLoading ? 'Deleting...' : 'Delete Account'}</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
