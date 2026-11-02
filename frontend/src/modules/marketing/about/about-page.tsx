import { CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScrollSpy } from '~/hooks/use-scroll-spy';
import { AboutDemo } from '~/modules/marketing/about/about-demo';
// import { FAQ } from '~/modules/marketing/about/faq';
import { Hero } from '~/modules/marketing/about/hero';
import { Highlights } from '~/modules/marketing/about/highlights';
import { AboutSection } from '~/modules/marketing/about/section';
import { MarketingFooter } from '~/modules/marketing/footer';
import { MarketingNav } from '~/modules/marketing/nav';
import { WaitlistForm } from '~/modules/requests/waitlist-form';

const aboutSectionIds = ['welcome', 'product'] as const;

export function AboutPage() {
  const { t } = useTranslation();

  const [joinedToWaitlist, setJoinedToWaitlist] = useState(false);

  useScrollSpy(aboutSectionIds);

  return (
    <>
      <MarketingNav />

      <main>
        <Hero title="about:title_1" demo={<AboutDemo />}>
          {joinedToWaitlist ? (
            <span className="flex items-center justify-between gap-2 rounded-full border-2 border-success px-4 py-3.5 ring-4 ring-primary/5">
              <CheckIcon className="size-8 text-success" />
              <span className="p-2">{t('c:in_waitlist')}</span>
            </span>
          ) : (
            <WaitlistForm
              className="max-sm:flex-row md:flex-row"
              buttonClassName="h-14 rounded-full ring-4 ring-primary/10 max-sm:h-12 max-sm:w-auto max-sm:shrink-0 max-sm:px-5 md:max-w-40"
              inputClassName="h-14 w-full rounded-full border border-gray-400/40 bg-background/50 px-8 py-6 text-base/6 ring-4 ring-primary/10 transition focus:border-gray-400 focus:outline-hidden focus-visible:ring-primary/20 max-sm:h-12 max-sm:min-w-0 max-sm:px-5 max-sm:py-4 sm:min-w-80"
              buttonContent={t('c:waitlist_request')}
              callback={() => setJoinedToWaitlist(true)}
            />
          )}
        </Hero>

        <div className="my-12">
          <AboutSection sectionId="product" title="about:title_2" text="about:text_2">
            <Highlights />
          </AboutSection>

          {/* <AboutSection sectionId="faqs" title="about:title_7" alternate>
            <FAQ />
          </AboutSection> */}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
