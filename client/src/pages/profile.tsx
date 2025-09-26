import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { profileAPI } from '@/lib/api';
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
      toast({ title: 'Update Failed', description: err.message || 'Error', variant: 'destructive' });
    }
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
      </main>
    </div>
  );
}
