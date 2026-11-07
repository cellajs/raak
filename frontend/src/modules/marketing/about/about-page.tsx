import { useScrollSpy } from '~/hooks/use-scroll-spy';
import { AboutDemo } from '~/modules/marketing/about/about-demo';
// import { FAQ } from '~/modules/marketing/about/faq';
import { Hero } from '~/modules/marketing/about/hero';
import { Highlights } from '~/modules/marketing/about/highlights';
import { AboutSection } from '~/modules/marketing/about/section';
import { MarketingFooter } from '~/modules/marketing/footer';
import { MarketingNav } from '~/modules/marketing/nav';

const aboutSectionIds = ['welcome', 'product'] as const;

export function AboutPage() {
  useScrollSpy(aboutSectionIds);

  return (
    // The live board's full window keeps the board alone in focus view
    <div className="focus-view-scope contents">
      <MarketingNav />

      <main className="focus:outline-hidden">
        <Hero title="about:title_1" text="about:tagline" demo={<AboutDemo />} />

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
    </div>
  );
}
