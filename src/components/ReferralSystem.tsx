import React, { useState } from 'react';
import { Share2, Gift, Users, Copy, Check } from 'lucide-react';
import { smartCommerceService } from '../services/smartCommerceService';
import { Lead } from '../types';

export default function ReferralSystem({ lead, ownerId, shopName }: { lead: Lead | null; ownerId: string; shopName: string }) {
  const [copied, setCopied] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);

  const generateCode = async () => {
    if (!lead) return;
    const code = await smartCommerceService.generateReferral(ownerId, lead.phone);
    setReferralCode(code);
  };

  const handleShare = async () => {
    if (!referralCode) return;
    const shareData = smartCommerceService.generateShareData('referral', {
      code: referralCode,
      shopName,
      shopSlug: ownerId // Or handle slug
    }, window.location.origin);
    
    await smartCommerceService.share(shareData);
  };

  if (!lead) return null;

  return (
    <div className="bg-gradient-to-br from-royal-gold/20 to-deep-navy/80 border border-royal-gold/30 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-royal-gold/10 rounded-full blur-3xl" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1 space-y-4 text-right">
          <div className="flex items-center gap-2 justify-end text-royal-gold mb-2">
            <Gift size={24} />
            <span className="font-black text-xl">الخصم التشاركي (جمعية JAM)</span>
          </div>
          <h4 className="text-3xl font-black leading-tight">كود خصم لك ولأصحابك!</h4>
          <p className="text-gray-400 text-sm font-bold">
            شارك كودك الخاص مع أصدقائك، وعند استخدامهم له أول مرة يحصل صديقك على خصم وأنت تحصل على نقاط ولاء مجانية في محفظتك.
          </p>

          {!referralCode ? (
            <button 
              onClick={generateCode}
              className="px-8 py-4 bg-royal-gold text-deep-navy font-black rounded-2xl hover:bg-gold-glow transition-all shadow-xl"
            >
              توليد كود الخصم الخاص بي
            </button>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 p-4 bg-white/10 rounded-2xl border border-white/20 justify-between">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(referralCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all"
                >
                  {copied ? <Check className="text-success" size={20} /> : <Copy size={20} />}
                </button>
                <span className="text-3xl font-black tracking-[0.3em] text-royal-gold uppercase">{referralCode}</span>
              </div>
              <button 
                onClick={handleShare}
                className="w-full py-4 bg-white text-deep-navy font-black rounded-2xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-all"
              >
                <Share2 size={18} />
                مشاركة الرابط والخصم
              </button>
            </div>
          )}
        </div>

        <div className="w-32 h-32 md:w-48 md:h-48 bg-royal-gold/10 rounded-full flex items-center justify-center border border-royal-gold/20 p-4">
          <div className="w-full h-full bg-royal-gold/20 rounded-full flex items-center justify-center border border-royal-gold/30">
            <Users size={64} className="text-royal-gold" />
          </div>
        </div>
      </div>
    </div>
  );
}
