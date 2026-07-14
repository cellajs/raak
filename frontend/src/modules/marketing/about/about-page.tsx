import { ArrowDownIcon, CheckIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appConfig } from 'shared';
import { useBreakpointBelow } from '~/hooks/use-breakpoints';
import { useScrollSpy } from '~/hooks/use-scroll-spy';
import { scrollToSectionById } from '~/hooks/use-scroll-spy-store';
import { FAQ } from '~/modules/marketing/about/faq';
import { Hero } from '~/modules/marketing/about/hero';
import { AboutSection } from '~/modules/marketing/about/section';
import '~/modules/marketing/about/glow-button.css';
import { Why } from '~/modules/marketing/about/why';
import { MarketingFooter } from '~/modules/marketing/footer';
import { MarketingNav } from '~/modules/marketing/nav';
import { WaitlistForm } from '~/modules/requests/waitlist-form';
import { Button } from '~/modules/ui/button';

export type AboutSectionId = (typeof aboutSectionIds)[number];

const aboutSectionIds = ['welcome', 'product', 'faqs'];

function AboutPage() {
  const { t } = useTranslation();
  const isMobile = useBreakpointBelow('sm', false);

  const [joinedToWaitlist, setJoinedToWaitlist] = useState(false);

  useScrollSpy(aboutSectionIds);

  return (
    <>
      <MarketingNav />

      <div className="container max-w-none px-0">
        {/* Hero landing */}
        <Hero key={'welcome'} title="about:title_1" text={isMobile ? undefined : 'about:text_1'}>
          {joinedToWaitlist ? (
            <span className="flex items-center justify-between gap-2 rounded-full border-2 border-success px-4 py-3.5 ring-4 ring-primary/5">
              <CheckIcon className="size-8 text-success" />
              <span className="p-2">{t('c:in_waitlist', { appName: appConfig.name })}</span>
            </span>
          ) : (
            <WaitlistForm
              className="md:flex-row"
              buttonClassName="h-14 rounded-full ring-4 md:max-w-40 ring-primary/10"
              inputClassName="xs:min-w-80 w-full py-6 h-14 px-8 rounded-full border border-gray-400/40 bg-background/50 text-base/6 ring-4 ring-primary/10 transition focus:border-gray-400 focus:outline-hidden focus-visible:ring-primary/20"
              buttonContent={`${t('c:waitlist_request')}`}
              callback={() => setJoinedToWaitlist(true)}
            />
          )}

          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => scrollToSectionById('product')}
            className="mt-8"
            aria-label="Read more"
          >
            <span>{t('about:why')}</span>
            <ArrowDownIcon className="ml-2 animate-bounce" />
          </Button>
        </Hero>

        <div className="my-12">
          {/* Why this product */}
          <AboutSection key={'product'} sectionId="product" title="about:title_2" text="about:text_2">
            <Why />
          </AboutSection>

          {/* FAQs */}
          <AboutSection key={'faqs'} sectionId="faqs" title="about:title_7" alternate={true}>
            <FAQ />
          </AboutSection>
        </div>
      </div>
      <MarketingFooter />
    </>
  );
}

export { AboutPage };
