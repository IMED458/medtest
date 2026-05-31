import React from 'react';
import { Activity, Volume2, Heart, Cpu, Baby, ExternalLink, Stethoscope } from 'lucide-react';

const MODULES = [
  {
    id: 'pediatric',
    icon: <Baby className="w-7 h-7 text-white" />,
    iconBg: 'bg-teal-500',
    headerFrom: 'from-teal-50 dark:from-teal-950/30',
    headerTo: 'to-cyan-50 dark:to-cyan-950/20',
    titleColor: 'text-teal-600 dark:text-teal-400',
    btnColor: 'bg-teal-500 hover:bg-teal-600',
    title: 'პედიატრიული აუსკულტაციის ტესტი',
    subtitle: 'ბავშვთა სტეტოსკოპიის ინტერაქტიული სიმულატორი',
    desc: 'ბავშვთა გულისა და ფილტვების ხმების ამოცნობა ინტერაქტიული სავარჯიშოებით.',
    url: 'https://imed458.github.io/pausc.github.io/',
  },
  {
    id: 'adult',
    icon: <Stethoscope className="w-7 h-7 text-white" />,
    iconBg: 'bg-indigo-500',
    headerFrom: 'from-indigo-50 dark:from-indigo-950/30',
    headerTo: 'to-blue-50 dark:to-blue-950/20',
    titleColor: 'text-indigo-600 dark:text-indigo-400',
    btnColor: 'bg-indigo-500 hover:bg-indigo-600',
    title: 'მოზრდილთა აუსკულტაციის ტესტი',
    subtitle: 'პროპედევტიკა — კლინიკური ფიზიკური გამოკვლევა',
    desc: 'მოზრდილთა გულ-სისხლძარღვთა და სასუნთქი სისტემის ხმების ამოცნობა.',
    url: 'https://imed458.github.io/propeausc.github.io/',
  },
];

export const AuscultationSection: React.FC = () => {
  return (
    <div id="auscultation-section" className="space-y-5 max-w-3xl mx-auto">

      <div>
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">
          🫁 აუსკულტაციის მოდულები
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans mt-0.5">
          ინტერაქტიული სიმულატორები — გახსენი ახალ ჩანართში და ივარჯიშე
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {MODULES.map(mod => (
          <div key={mod.id}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs flex flex-col">

            {/* Card Header */}
            <div className={`flex items-center gap-4 px-5 py-4 bg-gradient-to-r ${mod.headerFrom} ${mod.headerTo}`}>
              <div className={`w-12 h-12 ${mod.iconBg} rounded-2xl flex items-center justify-center shadow-md shrink-0`}>
                {mod.icon}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 font-sans leading-tight">
                  {mod.title}
                </h3>
                <p className={`text-[10px] font-semibold font-sans mt-0.5 ${mod.titleColor}`}>
                  {mod.subtitle}
                </p>
              </div>
            </div>

            {/* Card Body */}
            <div className="px-5 py-4 flex-1 flex flex-col justify-between gap-4">
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans leading-relaxed">
                {mod.desc}
              </p>

              {mod.url ? (
                <a href={mod.url} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold text-white transition cursor-pointer ${mod.btnColor}`}>
                  <ExternalLink className="w-3.5 h-3.5" />
                  ტესტის გახსნა
                </a>
              ) : (
                <button disabled
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed">
                  მალე დაემატება...
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Coming soon */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs">
        <h3 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-sans mb-3 flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
          მომავალში დაემატება
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: <Volume2 className="w-4 h-4 text-indigo-500" />, t: 'გულის ხმები', d: 'ტონები, შუილები, კარდიო.' },
            { icon: <Activity className="w-4 h-4 text-emerald-500" />, t: 'ფილტვების ხმები', d: 'სუნთქვა, ხიხინი, ბრონქ.' },
            { icon: <Cpu className="w-4 h-4 text-purple-500" />, t: 'კლინიკური სიმ.', d: 'ვირტუალური ინტ. ქეისები.' },
          ].map(item => (
            <div key={item.t} className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">{item.icon}</div>
              <div className="font-sans">
                <h4 className="font-semibold text-zinc-700 dark:text-zinc-200 text-[11px]">{item.t}</h4>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{item.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
