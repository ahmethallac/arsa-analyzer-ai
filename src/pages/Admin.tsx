import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Loader2, Users, FileText, Ticket, Plus, Trash2, CreditCard, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type AdminUser = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  current_credits: number;
  total_purchased: number;
  report_count: number;
  is_admin: boolean;
  created_at: string;
};

type AdminReport = {
  id: string;
  user_id: string;
  email: string | null;
  title: string | null;
  created_at: string;
  expires_at: string;
};

type AdminPromo = {
  id: string;
  code: string;
  credits: number;
  is_unlimited: boolean;
  usage_count: number;
  created_at: string;
};

type PromoUsage = {
  id: string;
  device_id: string;
  created_at: string;
};

const formatDate = (iso: string) => new Date(iso).toLocaleString('tr-TR');

export default function Admin() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();
  const { toast } = useToast();

  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Auth form
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sending, setSending] = useState(false);

  // Data
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [loading, setLoading] = useState(false);

  // Grant credits dialog
  const [grantUser, setGrantUser] = useState<AdminUser | null>(null);
  const [grantAmount, setGrantAmount] = useState('10');

  // Delete user
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  // New promo
  const [newCode, setNewCode] = useState('');
  const [newCredits, setNewCredits] = useState('5');
  const [newUnlimited, setNewUnlimited] = useState(true);
  const [creatingPromo, setCreatingPromo] = useState(false);

  // Promo usages
  const [promoDetail, setPromoDetail] = useState<AdminPromo | null>(null);
  const [promoUsages, setPromoUsages] = useState<PromoUsage[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setChecking(false); return; }
    (async () => {
      const { data, error } = await supabase.rpc('is_current_user_admin');
      if (error) {
        setIsAdmin(false);
      } else {
        setIsAdmin(Boolean(data));
      }
      setChecking(false);
    })();
  }, [user, authLoading]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: u }, { data: r }, { data: p }] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase.rpc('admin_list_reports'),
      supabase.rpc('admin_list_promo_codes'),
    ]);
    setUsers((u as AdminUser[]) || []);
    setReports((r as AdminReport[]) || []);
    setPromos((p as AdminPromo[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) loadAll();
  }, [isAdmin, loadAll]);

  const sendOtp = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return;
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/admin` },
    });
    setSending(false);
    if (error) {
      toast({ title: 'Kod gönderilemedi', description: error.message, variant: 'destructive' });
      return;
    }
    setOtpSent(true);
    toast({ title: 'Kod gönderildi', description: 'E-postanıza gelen 6 haneli kodu girin.' });
  };

  const verifyOtp = async () => {
    const normalized = email.trim().toLowerCase();
    const token = code.trim();
    if (!normalized || token.length < 6) return;
    setSending(true);
    const { error } = await supabase.auth.verifyOtp({ email: normalized, token, type: 'email' });
    setSending(false);
    if (error) {
      toast({ title: 'Kod hatalı', description: error.message, variant: 'destructive' });
      return;
    }
    // Auth state listener will pick up session; re-check admin.
    setChecking(true);
  };

  const handleGrant = async () => {
    if (!grantUser) return;
    const amount = parseInt(grantAmount, 10);
    if (!amount || amount === 0) {
      toast({ title: 'Geçersiz miktar', variant: 'destructive' });
      return;
    }
    const { data, error } = await supabase.rpc('admin_grant_credits', {
      p_user_id: grantUser.user_id, p_amount: amount, p_note: 'Admin tarafından eklendi',
    });
    if (error || !(data as { success?: boolean })?.success) {
      toast({ title: 'Kredi eklenemedi', description: error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Kredi eklendi', description: `${amount} kredi eklendi.` });
    setGrantUser(null);
    setGrantAmount('10');
    loadAll();
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const { data, error } = await supabase.rpc('admin_delete_user', { p_user_id: deleteUser.user_id });
    if (error || !(data as { success?: boolean })?.success) {
      toast({ title: 'Silinemedi', description: error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Hesap silindi' });
    setDeleteUser(null);
    loadAll();
  };

  const handleCreatePromo = async () => {
    const codeVal = newCode.trim().toUpperCase();
    const creditsVal = parseInt(newCredits, 10);
    if (!/^[A-Z0-9]{3,20}$/.test(codeVal)) {
      toast({ title: 'Kod 3-20 karakter arası olmalı (harf/rakam).', variant: 'destructive' });
      return;
    }
    if (!creditsVal || creditsVal <= 0) {
      toast({ title: 'Geçerli bir kredi miktarı girin.', variant: 'destructive' });
      return;
    }
    setCreatingPromo(true);
    const { data, error } = await supabase.rpc('admin_create_promo_code', {
      p_code: codeVal, p_credits: creditsVal, p_is_unlimited: newUnlimited,
    });
    setCreatingPromo(false);
    const result = data as { success?: boolean; error?: string } | null;
    if (error || !result?.success) {
      toast({ title: 'Kupon oluşturulamadı', description: result?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Kupon oluşturuldu', description: codeVal });
    setNewCode(''); setNewCredits('5'); setNewUnlimited(true);
    loadAll();
  };

  const handleDeletePromo = async (id: string) => {
    if (!confirm('Bu kuponu silmek istediğinizden emin misiniz?')) return;
    const { error } = await supabase.rpc('admin_delete_promo_code', { p_id: id });
    if (error) {
      toast({ title: 'Silinemedi', description: error.message, variant: 'destructive' });
      return;
    }
    loadAll();
  };

  const openPromoDetail = async (p: AdminPromo) => {
    setPromoDetail(p);
    const { data } = await supabase.rpc('admin_list_promo_usages', { p_promo_code_id: p.id });
    setPromoUsages((data as PromoUsage[]) || []);
  };

  // ---------- Render states ----------

  if (authLoading || checking) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[100dvh] gradient-hero flex flex-col">
        <header className="px-4 py-6">
          <Link to="/" className="flex items-center gap-3 max-w-md mx-auto">
            <div className="p-2.5 rounded-xl gradient-primary shadow-glow">
              <MapPin className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">Arsa Analiz · Admin</h1>
          </Link>
        </header>
        <main className="flex-1 px-4 flex items-start justify-center">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Yönetim Girişi</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              E-posta adresinize gelen 6 haneli kod ile giriş yapın.
            </p>

            {!otpSent ? (
              <div className="space-y-3">
                <Label>E-posta</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@email.com" className="h-12" />
                <Button onClick={sendOtp} disabled={sending || !email.trim()} className="w-full h-12 gradient-primary">
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Kod Gönder'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Doğrulama kodu</Label>
                <Input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6 haneli kod" className="h-12 tracking-widest text-center" maxLength={6} />
                <Button onClick={verifyOtp} disabled={sending || code.trim().length < 6} className="w-full h-12 gradient-primary">
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Giriş Yap'}
                </Button>
                <button className="text-xs text-muted-foreground underline" onClick={() => { setOtpSent(false); setCode(''); }}>
                  Farklı e-posta ile dene
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 px-4">
        <ShieldCheck className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">Yetkisiz</h2>
        <p className="text-sm text-muted-foreground text-center">Bu sayfaya erişim yetkiniz yok.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => signOut()}>Çıkış Yap</Button>
          <Button onClick={() => navigate('/')}>Ana Sayfa</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="p-2 rounded-xl gradient-primary">
              <MapPin className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-bold">Arsa Analiz</h1>
              <p className="text-xs text-muted-foreground">Yönetim Paneli</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
            <Button variant="outline" size="sm" onClick={() => signOut()}>
              <LogOut className="w-4 h-4 mr-1" /> Çıkış
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users"><Users className="w-4 h-4 mr-1" /> Kullanıcılar</TabsTrigger>
            <TabsTrigger value="reports"><FileText className="w-4 h-4 mr-1" /> Raporlar</TabsTrigger>
            <TabsTrigger value="promos"><Ticket className="w-4 h-4 mr-1" /> Kuponlar</TabsTrigger>
          </TabsList>

          {/* Users */}
          <TabsContent value="users" className="mt-4">
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3">E-posta</th>
                      <th className="text-right p-3">Mevcut Kredi</th>
                      <th className="text-right p-3">Satın Alınan</th>
                      <th className="text-right p-3">Rapor</th>
                      <th className="text-left p-3">Kayıt</th>
                      <th className="text-right p-3">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.user_id} className="border-t border-border">
                        <td className="p-3">
                          {u.email || '—'}
                          {u.is_admin && <span className="ml-2 text-[10px] uppercase text-primary font-bold">admin</span>}
                        </td>
                        <td className="p-3 text-right">{u.current_credits}</td>
                        <td className="p-3 text-right">{u.total_purchased}</td>
                        <td className="p-3 text-right">{u.report_count}</td>
                        <td className="p-3 text-xs text-muted-foreground">{formatDate(u.created_at)}</td>
                        <td className="p-3 text-right whitespace-nowrap">
                          <Button size="sm" variant="outline" onClick={() => setGrantUser(u)}>
                            <CreditCard className="w-3.5 h-3.5 mr-1" /> Kredi
                          </Button>
                          {!u.is_admin && (
                            <Button size="sm" variant="ghost" className="text-destructive ml-1" onClick={() => setDeleteUser(u)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 && (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Henüz kullanıcı yok.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          {/* Reports */}
          <TabsContent value="reports" className="mt-4">
            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3">E-posta</th>
                      <th className="text-left p-3">Başlık</th>
                      <th className="text-left p-3">Tarih / Saat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r.id} className="border-t border-border">
                        <td className="p-3">{r.email || '—'}</td>
                        <td className="p-3">{r.title || '—'}</td>
                        <td className="p-3 text-xs text-muted-foreground">{formatDate(r.created_at)}</td>
                      </tr>
                    ))}
                    {reports.length === 0 && (
                      <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Henüz rapor yok.</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </TabsContent>

          {/* Promo codes */}
          <TabsContent value="promos" className="mt-4 space-y-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Yeni Kupon</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <div>
                  <Label className="text-xs">Kod</Label>
                  <Input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} placeholder="HEDIYE10" />
                </div>
                <div>
                  <Label className="text-xs">Kredi</Label>
                  <Input type="number" value={newCredits} onChange={(e) => setNewCredits(e.target.value)} min="1" />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Checkbox id="unlimited" checked={newUnlimited} onCheckedChange={(v) => setNewUnlimited(Boolean(v))} />
                  <Label htmlFor="unlimited" className="text-xs">Sınırsız kullanım</Label>
                </div>
                <Button onClick={handleCreatePromo} disabled={creatingPromo} className="mt-auto">
                  {creatingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Oluştur'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Kupon her cihaz için yalnızca bir kez kullanılabilir. Kullanım için üyelik zorunludur.</p>
            </div>

            <div className="rounded-lg border border-border bg-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Kod</th>
                    <th className="text-right p-3">Kredi</th>
                    <th className="text-right p-3">Kullanım</th>
                    <th className="text-left p-3">Oluşturuldu</th>
                    <th className="text-right p-3">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3 font-mono">{p.code}</td>
                      <td className="p-3 text-right">{p.credits}</td>
                      <td className="p-3 text-right">
                        <button className="underline" onClick={() => openPromoDetail(p)}>{p.usage_count}</button>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDate(p.created_at)}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeletePromo(p.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {promos.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Henüz kupon yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Grant credits dialog */}
      <Dialog open={!!grantUser} onOpenChange={(o) => !o && setGrantUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kredi Ekle</DialogTitle>
            <DialogDescription>{grantUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Miktar (negatif değer düşürür)</Label>
            <Input type="number" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantUser(null)}>Vazgeç</Button>
            <Button onClick={handleGrant}>Ekle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete user dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hesabı Sil</DialogTitle>
            <DialogDescription>
              <strong>{deleteUser?.email}</strong> ve tüm verileri (kredi geçmişi, raporlar) kalıcı olarak silinecek.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Vazgeç</Button>
            <Button variant="destructive" onClick={handleDelete}>Kalıcı Olarak Sil</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promo usages dialog */}
      <Dialog open={!!promoDetail} onOpenChange={(o) => !o && setPromoDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{promoDetail?.code} kullanımları</DialogTitle>
            <DialogDescription>Toplam {promoUsages.length} kullanım</DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {promoUsages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Henüz kullanım yok.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-2">Cihaz</th>
                    <th className="text-left p-2">Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {promoUsages.map((u) => (
                    <tr key={u.id} className="border-t border-border">
                      <td className="p-2 font-mono text-xs">{u.device_id.slice(0, 24)}…</td>
                      <td className="p-2 text-xs">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
