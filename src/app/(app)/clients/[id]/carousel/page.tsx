"use client";

import { useParams } from "next/navigation";
import { CarouselReactMode } from "@/components/carousel-react-mode";

export default function ClientCarouselPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  return <CarouselReactMode clientId={clientId} />;
}
