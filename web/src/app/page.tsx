import { Hero } from "@/components/Hero";
import { EmbossedWordmark } from "@/components/home/EmbossedWordmark";
import { HowItWorks } from "@/components/home/HowItWorks";
import { PrivacySection } from "@/components/home/PrivacySection";
import { TechSection } from "@/components/home/TechSection";
import { ClosingCta } from "@/components/home/ClosingCta";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <EmbossedWordmark />
      <HowItWorks />
      <PrivacySection />
      <TechSection />
      <ClosingCta />
    </>
  );
}
