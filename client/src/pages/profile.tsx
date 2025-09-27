import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { profileAPI } from '@/lib/api';
import { useAuth } from '@/hooks/use-auth';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { showApiError } from '@/lib/errors';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  bio: z.string().max(500).optional().or(z.literal('')),
  avatarUrl: z.string().url().max(500).optional().or(z.literal('')),
  preferences: z.string().optional().or(z.literal('')),
});

type FormValues = z.infer<typeof formSchema>;

export default function ProfilePage() {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [showDelete, setShowDelete] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['profile'], queryFn: () => profileAPI.get().then(r => r.data) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      let prefs: any = undefined;
      if (values.preferences) {
        try { prefs = JSON.parse(values.preferences); } catch {}
      }
      return profileAPI.update({
        name: values.name,
        bio: values.bio || undefined,
        avatarUrl: values.avatarUrl || undefined,
        preferences: prefs,
      });
    },
    onSuccess: () => {
      toast({ title: 'Profile Updated' });
    },
    onError: (err: any) => {
      showApiError(toast, err, 'Failed to update profile');
    }
  });

  const passwordSchema = z.object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
  });
  type PasswordValues = z.infer<typeof passwordSchema>;
  const { register: pwRegister, handleSubmit: handlePwSubmit, reset: resetPw, formState: { errors: pwErrors } } = useForm<PasswordValues>({ resolver: zodResolver(passwordSchema) });
  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) => profileAPI.changePassword(values),
    onSuccess: () => {
      toast({ title: 'Password Updated' });
      resetPw();
    },
    onError: (err: any) => showApiError(toast, err, 'Failed to change password')
  });

  const deleteSchema = z.object({ password: z.string().min(6).optional() });
  type DeleteValues = z.infer<typeof deleteSchema>;
  const { register: delRegister, handleSubmit: handleDeleteSubmit, formState: { errors: delErrors }, reset: resetDelete } = useForm<DeleteValues>({ resolver: zodResolver(deleteSchema) });
  const deleteMutation = useMutation({
    mutationFn: (values: DeleteValues) => profileAPI.deleteAccount(values),
    onSuccess: () => {
      toast({ title: 'Account Deleted', description: 'Your account has been removed.' });
      logout();
    },
    onError: (err: any) => showApiError(toast, err, 'Failed to delete account')
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  useEffect(() => {
    if (data) {
      reset({
        name: data.name || '',
        bio: data.bio || '',
        avatarUrl: data.avatarUrl || '',
        preferences: data.preferences ? JSON.stringify(data.preferences, null, 2) : ''
      });
    }
  }, [data, reset]);

  const onSubmit = (values: FormValues) => mutation.mutate(values);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold mb-6 text-slate-900">My Profile</h2>
        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="p-4 text-slate-500">Loading...</div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <Input placeholder="Your name" {...register('name')} />
                  {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Bio</label>
                  <Textarea rows={3} placeholder="Short bio" {...register('bio')} />
                  {errors.bio && <p className="text-xs text-red-600 mt-1">{errors.bio.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Avatar URL</label>
                  <Input placeholder="https://..." {...register('avatarUrl')} />
                  {errors.avatarUrl && <p className="text-xs text-red-600 mt-1">{errors.avatarUrl.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center justify-between">
                    <span>Preferences JSON</span>
                    <Button type="button" variant="ghost" size="sm" onClick={() => reset(v => ({ ...v, preferences: JSON.stringify({ theme: 'light' }, null, 2) }))}>Sample</Button>
                  </label>
                  <Textarea rows={6} placeholder='{"theme":"dark"}' {...register('preferences')} />
                  {errors.preferences && <p className="text-xs text-red-600 mt-1">{errors.preferences.message}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        <div className="mt-8 grid gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePwSubmit(v => passwordMutation.mutate(v))} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-1">Current Password</label>
                  <Input type="password" {...pwRegister('currentPassword')} />
                  {pwErrors.currentPassword && <p className="text-xs text-red-600 mt-1">{pwErrors.currentPassword.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">New Password</label>
                  <Input type="password" {...pwRegister('newPassword')} />
                  {pwErrors.newPassword && <p className="text-xs text-red-600 mt-1">{pwErrors.newPassword.message}</p>}
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={passwordMutation.isPending}>{passwordMutation.isPending ? 'Updating...' : 'Update Password'}</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-red-300">
            <CardHeader>
              <CardTitle className="text-red-700">Danger Zone</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 mb-4">This action will permanently delete your account. This cannot be undone.</p>
              <Dialog open={showDelete} onOpenChange={(o)=>{ setShowDelete(o); if(!o) resetDelete(); }}>
                <DialogTrigger asChild>
                  <Button variant="destructive">Delete Account</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirm Account Deletion</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleDeleteSubmit(v => deleteMutation.mutate(v))} className="space-y-4">
                    <p className="text-sm">Optionally confirm with your password (required if server enforces).</p>
                    <div>
                      <label className="block text-sm font-medium mb-1">Password (optional)</label>
                      <Input type="password" placeholder="••••••" {...delRegister('password')} />
                      {delErrors.password && <p className="text-xs text-red-600 mt-1">{delErrors.password.message}</p>}
                    </div>
                    <DialogFooter className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={()=>setShowDelete(false)}>Cancel</Button>
                      <Button type="submit" variant="destructive" disabled={deleteMutation.isPending}>{deleteMutation.isPending ? 'Deleting...' : 'Delete Account'}</Button>
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
