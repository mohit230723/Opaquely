import { Hero } from "@/components/Hero";
import { EmbossedWordmark } from "@/components/home/EmbossedWordmark";
import { FlowSteps } from "@/components/FlowSteps";
import { PrivacySection } from "@/components/home/PrivacySection";
import { TechSection } from "@/components/home/TechSection";
import { ClosingCta } from "@/components/home/ClosingCta";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <EmbossedWordmark />
      <FlowSteps />
      <PrivacySection />
      <TechSection />
      <ClosingCta />
    </>
  );
}
