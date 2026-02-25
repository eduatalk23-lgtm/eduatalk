import { FOOTER_LINKS, SOCIAL_LINKS, CONTACT_ICON_MAP } from "./constants";

export function LandingFooter() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <h3 className="text-xl font-extrabold text-white mb-3">
              TimeLevelUp
            </h3>
            <p className="text-sm leading-relaxed text-slate-400 mb-6">
              AI 기반 맞춤형 학습 관리 시스템으로
              <br />
              13년 입시 전문 노하우를 담았습니다.
            </p>
            <div className="flex gap-3">
              {SOCIAL_LINKS.map(({ icon: SocialIcon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                  aria-label={label}
                >
                  <SocialIcon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <h4 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
                {group.title}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((link) => {
                  const ContactIcon = CONTACT_ICON_MAP[link.label];
                  return (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-white"
                      >
                        {ContactIcon && <ContactIcon className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
                        {link.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-slate-800 pt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} TimeLevelUp. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-slate-500">
            <a href="#" className="hover:text-slate-300">
              이용약관
            </a>
            <a href="#" className="hover:text-slate-300">
              개인정보처리방침
            </a>
            <a href="mailto:support@eduatalk.kr?subject=사업자정보 문의" className="hover:text-slate-300">
              사업자정보 확인
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
