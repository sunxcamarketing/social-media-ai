"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Lang = "de" | "en";

const translations: Record<string, { de: string; en: string }> = {
  // Navigation & Sidebar
  "nav.strategy": { de: "Strategie", en: "Strategy" },
  "nav.new": { de: "Neu", en: "New" },
  "nav.noClients": { de: "Noch keine Clients", en: "No clients yet" },
  "nav.selectClient": { de: "Wähle einen Client aus", en: "Select a client" },
  "nav.tools": { de: "Tools", en: "Tools" },

  // New Client Dialog
  "newClient.title": { de: "Neuer Client", en: "New Client" },
  "newClient.subtitle": { de: "Gib die Links an — die KI füllt das Profil automatisch aus.", en: "Provide the links — AI will fill in the profile automatically." },
  "newClient.namePlaceholder": { de: "Max Mustermann", en: "John Doe" },
  "newClient.igPlaceholder": { de: "@handle oder instagram.com/...", en: "@handle or instagram.com/..." },
  "newClient.linkHint": { de: "Mindestens einen Link angeben damit die KI das Profil automatisch ausfüllen kann.", en: "Add at least one link so AI can auto-fill the profile." },
  "newClient.creating": { de: "Erstelle...", en: "Creating..." },
  "newClient.createAndAnalyze": { de: "Anlegen & KI-Analyse starten", en: "Create & Start AI Analysis" },
  "newClient.create": { de: "Client anlegen", en: "Create Client" },

  // Information Page
  "info.loading": { de: "Laden…", en: "Loading…" },
  "info.addInfo": { de: "Info hinzufügen", en: "Add info" },
  "info.autoFill": { de: "Auto-fill", en: "Auto-fill" },
  "info.filling": { de: "Füllt aus…", en: "Filling…" },
  "info.scraping": { de: "Scraping profiles and extracting information with AI… this takes 15–30 seconds.", en: "Scraping profiles and extracting information with AI… this takes 15–30 seconds." },
  "info.links": { de: "Links", en: "Links" },
  "info.igProfile": { de: "Instagram Profil", en: "Instagram Profile" },
  "info.refresh": { de: "Aktualisieren", en: "Refresh" },
  "info.refreshing": { de: "Lädt…", en: "Loading…" },
  "info.profileLoading": { de: "Profil wird geladen…", en: "Loading profile…" },
  "info.follower": { de: "Follower", en: "Followers" },
  "info.following": { de: "Following", en: "Following" },
  "info.posts": { de: "Posts", en: "Posts" },
  "info.basicInfo": { de: "Basis-Informationen", en: "Basic Information" },
  "info.brandIdentity": { de: "Markenidentität", en: "Brand Identity" },
  "info.customerProblem": { de: "Kunde & Problem", en: "Customer & Problem" },
  "info.brandMessage": { de: "Markenbotschaft", en: "Brand Message" },
  "info.noInfoYet": { de: "Noch keine Informationen.", en: "No information added yet." },
  "info.addInformation": { de: "Informationen hinzufügen", en: "Add information" },
  "info.edit": { de: "Bearbeiten", en: "Edit" },
  "info.save": { de: "Speichern", en: "Save Changes" },
  "info.saving": { de: "Wird gespeichert…", en: "Saving…" },

  // Follow-up dialog
  "followup.title": { de: "Profil vervollständigen", en: "Complete Profile" },
  "followup.answer": { de: "Deine Antwort…", en: "Your answer…" },
  "followup.skip": { de: "Überspringen", en: "Skip" },
  "followup.done": { de: "Fertig", en: "Done" },
  "followup.next": { de: "Weiter", en: "Next" },

  // Follow-up questions
  "fq.businessContext.label": { de: "Business Context", en: "Business Context" },
  "fq.businessContext.question": { de: "Was machst du genau, und wen hilfst du damit?", en: "What exactly do you do, and who do you help?" },
  "fq.professionalBackground.label": { de: "Beruflicher Hintergrund", en: "Professional Background" },
  "fq.professionalBackground.question": { de: "Was ist dein beruflicher Hintergrund und deine Expertise?", en: "What is your professional background and expertise?" },
  "fq.keyAchievements.label": { de: "Erfolge & Meilensteine", en: "Achievements & Milestones" },
  "fq.keyAchievements.question": { de: "Was sind deine größten Erfolge, Zahlen oder Auszeichnungen?", en: "What are your biggest achievements, numbers, or awards?" },
  "fq.brandFeeling.label": { de: "Gefühl das du verkaufst", en: "Feeling you sell" },
  "fq.brandFeeling.question": { de: "Welches Gefühl vermittelst du deinen Kunden? (z.B. Sicherheit, Klarheit, Freiheit)", en: "What feeling do you convey to your customers? (e.g. security, clarity, freedom)" },
  "fq.brandProblem.label": { de: "Kernproblem", en: "Core Problem" },
  "fq.brandProblem.question": { de: "Was ist das eine Problem das du für deine Kunden löst?", en: "What is the one problem you solve for your customers?" },
  "fq.providerRole.label": { de: "Deine Rolle", en: "Your Role" },
  "fq.providerRole.question": { de: "Wie würdest du deine Rolle beschreiben? (Mentor, Coach, Stratege, Sparringspartner...)", en: "How would you describe your role? (Mentor, Coach, Strategist, Sparring Partner...)" },
  "fq.providerBeliefs.label": { de: "Deine Überzeugungen", en: "Your Beliefs" },
  "fq.providerBeliefs.question": { de: "Was glaubst du, was in deiner Branche falsch gemacht wird?", en: "What do you think is being done wrong in your industry?" },
  "fq.providerStrengths.label": { de: "Deine Stärken", en: "Your Strengths" },
  "fq.providerStrengths.question": { de: "Was schätzen deine Kunden an dir am meisten?", en: "What do your customers appreciate most about you?" },
  "fq.brandingStatement.label": { de: "Branding Statement", en: "Branding Statement" },
  "fq.brandingStatement.question": { de: "Wie lautet dein Branding Statement? (Ich helfe [Zielgruppe], von [Ausgangspunkt], damit [Ergebnis].)", en: "What is your Branding Statement? (I help [target audience], from [starting point], so that [result].)" },
  "fq.humanDifferentiation.label": { de: "Dein AND-Faktor", en: "Your AND Factor" },
  "fq.humanDifferentiation.question": { de: "Was macht dich als Mensch einzigartig — dein AND-Faktor?", en: "What makes you unique as a person — your AND factor?" },

  // Add Info Dialog
  "addInfo.title": { de: "Informationen hinzufügen", en: "Add Information" },
  "addInfo.description": { de: "Füge beliebigen Text über diesen Client ein — Interview-Notizen, Bio, Fakten, Erfolge. Die KI ordnet es den richtigen Feldern zu.", en: "Paste any text about this client — interview notes, bio, facts, achievements. AI will place it into the right fields." },
  "addInfo.placeholder": { de: "z.B. Sie hat den Forbes 30 Under 30 Award gewonnen...", en: "e.g. She won the Forbes 30 Under 30 award in 2023..." },
  "addInfo.submit": { de: "Zum Profil hinzufügen", en: "Add to Profile" },
  "addInfo.processing": { de: "Wird verarbeitet…", en: "Processing…" },

  // Edit Dialogs - Basic Info
  "editBasic.title": { de: "Basis-Informationen bearbeiten", en: "Edit Basic Information" },
  "editBasic.fullName": { de: "Vollständiger Name", en: "Full Name" },
  "editBasic.company": { de: "Unternehmen", en: "Company" },
  "editBasic.role": { de: "Rolle", en: "Role" },
  "editBasic.location": { de: "Standort", en: "Location" },
  "editBasic.businessContext": { de: "Business Context", en: "Business Context" },
  "editBasic.professionalBackground": { de: "Beruflicher Hintergrund", en: "Professional Background" },
  "editBasic.keyAchievements": { de: "Erfolge & Meilensteine", en: "Key Achievements" },

  // Edit Dialogs - Brand
  "editBrand.title": { de: "Markenidentität", en: "Brand Identity" },
  "editBrand.feeling": { de: "Gefühl das du verkaufst (z.B. Sicherheit, Klarheit, Selbstvertrauen)", en: "Feeling you sell (e.g. security, clarity, confidence)" },
  "editBrand.problem": { de: "Kernproblem das du löst", en: "Core problem you solve" },
  "editBrand.dreamCustomer": { de: "Traumkunde-Profil", en: "Dream Customer Profile" },
  "editBrand.description": { de: "Konkrete Personenbeschreibung", en: "Concrete person description" },

  // Edit Dialogs - Customer
  "editCustomer.title": { de: "Kunde & Problem", en: "Customer & Problem" },
  "editCustomer.problems": { de: "Kundenprobleme", en: "Customer Problems" },
  "editCustomer.mental": { de: "Mentale Probleme", en: "Mental problems" },
  "editCustomer.physical": { de: "Physische Probleme", en: "Physical problems" },
  "editCustomer.financial": { de: "Finanzielle Probleme", en: "Financial problems" },
  "editCustomer.social": { de: "Soziale Probleme", en: "Social problems" },
  "editCustomer.aesthetic": { de: "Ästhetische Probleme", en: "Aesthetic problems" },
  "editCustomer.providerRole": { de: "Deine Rolle als Anbieter (Mentor? Stratege? Sparringspartner?)", en: "Your role as provider (Mentor? Strategist? Sparring partner?)" },
  "editCustomer.beliefs": { de: "Deine Überzeugungen (Was wird in deiner Branche falsch gemacht?)", en: "Your beliefs (What is being done wrong in your industry?)" },
  "editCustomer.strengths": { de: "Deine Stärken (Was schätzen deine Kunden am meisten?)", en: "Your strengths & skills (What do clients appreciate most?)" },
  "editCustomer.authenticity": { de: "Authentizitätszone (Wo überschneiden sich Kundenproblem und deine Stärke?)", en: "Authenticity zone (Where customer problem overlaps with your strength)" },

  // Edit Dialogs - Message
  "editMessage.title": { de: "Markenbotschaft", en: "Brand Message" },
  "editMessage.statement": { de: "Branding Statement", en: "Branding Statement" },
  "editMessage.statementHint": { de: "Formel: Ich helfe [Zielgruppe], von [Transformation], damit [Ergebnis].", en: "Formula: I help [target group], from [transformation], so that [result]." },
  "editMessage.statementPlaceholder": { de: "Ich helfe Selbständigen, Struktur in ihre Sichtbarkeit zu bringen…", en: "I help freelancers bring structure to their visibility…" },
  "editMessage.human": { de: "Menschliche Differenzierung — dein AND-Faktor", en: "Human differentiation — your AND factor" },
  "editMessage.humanHint": { de: "Du bist ein [Anbieter] UND...? Wie hebst du dich menschlich ab?", en: "You are a [provider] AND...? How do you stand out as a person?" },

  // Info labels
  "label.name": { de: "Name", en: "Name" },
  "label.company": { de: "Unternehmen", en: "Company" },
  "label.role": { de: "Rolle", en: "Role" },
  "label.location": { de: "Standort", en: "Location" },
  "label.businessContext": { de: "Business Context", en: "Business Context" },
  "label.professionalBackground": { de: "Beruflicher Hintergrund", en: "Professional Background" },
  "label.keyAchievements": { de: "Erfolge & Meilensteine", en: "Key Achievements" },
  "label.feelingYouSell": { de: "Gefühl das du verkaufst", en: "Feeling you sell" },
  "label.coreProblem": { de: "Kernproblem das du löst", en: "Core problem you solve" },
  "label.dreamCustomerProfile": { de: "Traumkunde-Profil", en: "Dream Customer Profile" },
  "label.description": { de: "Beschreibung", en: "Description" },
  "label.brandingStatement": { de: "Branding Statement", en: "Branding Statement" },
  "label.humanDifferentiation": { de: "Menschliche Differenzierung (dein AND-Faktor)", en: "Human differentiation (your AND factor)" },
  "label.providerRole": { de: "Deine Rolle als Anbieter", en: "Your role as provider" },
  "label.beliefs": { de: "Deine Überzeugungen", en: "Your beliefs" },
  "label.strengths": { de: "Deine Stärken", en: "Your strengths" },
  "label.authenticityZone": { de: "Authentizitätszone", en: "Authenticity zone" },
  "label.customerProblems": { de: "Kundenprobleme", en: "Customer Problems" },

  // Strategy Page
  "strategy.title": { de: "Strategie", en: "Strategy" },
  "strategy.subtitle": { de: "Content-Strategie und Performance-Insights", en: "Content strategy and performance insights" },
  "strategy.frameworkActive": { de: "Strategie-Framework aktiv", en: "Strategy Framework Active" },
  "strategy.perWeek": { de: "pro Woche", en: "per week" },
  "strategy.formats": { de: "Formate", en: "Formats" },
  "strategy.trainingExamples": { de: "Training-Beispiele", en: "Training Examples" },
  "strategy.viewFramework": { de: "Framework ansehen", en: "View Framework" },
  "strategy.performance": { de: "Performance-Analyse", en: "Performance Analysis" },
  "strategy.lastAnalyzed": { de: "Zuletzt analysiert:", en: "Last analyzed:" },
  "strategy.last": { de: "letzte", en: "last" },
  "strategy.days": { de: "Tage", en: "days" },
  "strategy.analyzing": { de: "Analysiert…", en: "Analyzing…" },
  "strategy.reanalyze": { de: "Neu analysieren", en: "Re-analyze" },
  "strategy.analyze": { de: "Analysieren", en: "Analyze" },
  "strategy.scrapingProfile": { de: "Instagram-Profil wird gescrapt…", en: "Scraping Instagram profile…" },
  "strategy.downloadingVideos": { de: "Top-Videos werden heruntergeladen & bei Gemini hochgeladen…", en: "Downloading top videos & uploading to Gemini…" },
  "strategy.analyzingHooks": { de: "Hooks, Scripts und Performance werden analysiert…", en: "Analyzing hooks, scripts, and performance…" },
  "strategy.analysisDuration": { de: "Das dauert 1–3 Minuten.", en: "This takes 1–3 minutes." },
  "strategy.noAnalysis": { de: "Noch keine Analyse vorhanden.", en: "No analysis yet." },
  "strategy.analyzeHint": { de: "Analysieren klicken, um das Instagram-Profil zu scrapen und herauszufinden, was funktioniert.", en: "Click Analyze to scrape the Instagram profile and find out what works." },
  "strategy.topLast30": { de: "Top — Letzte 30 Tage", en: "Top — Last 30 Days" },
  "strategy.topLast": { de: "Top — Letzte", en: "Top — Last" },
  "strategy.excludingLast30": { de: "(ohne letzte 30)", en: "(excluding last 30)" },
  "strategy.contentStrategy": { de: "Content-Strategie", en: "Content Strategy" },
  "strategy.generating": { de: "Generiert…", en: "Generating…" },
  "strategy.generateWithAI": { de: "Mit KI generieren", en: "Generate with AI" },
  "strategy.editStrategy": { de: "Bearbeiten", en: "Edit" },
  "strategy.aiGenerating": { de: "KI analysiert das Kundenprofil und erstellt eine Strategie…", en: "AI is analyzing the customer profile and creating a strategy…" },
  "strategy.trainingConsidered": { de: "Training-Beispiele aus der Strategie-Bibliothek werden berücksichtigt.", en: "Training examples from the strategy library are being considered." },
  "strategy.noStrategy": { de: "Noch keine Strategie vorhanden.", en: "No strategy yet." },
  "strategy.aiSuggestion": { de: "KI erstellt einen Vorschlag basierend auf dem Kundenprofil", en: "AI creates a suggestion based on the customer profile" },
  "strategy.savedTraining": { de: "gespeicherten Training-Beispielen", en: "saved training examples" },
  "strategy.addManually": { de: "Manuell hinzufügen", en: "Add manually" },
  "strategy.primaryGoal": { de: "Primäres Ziel", en: "Primary Goal" },
  "strategy.contentPillars": { de: "Content Pillars", en: "Content Pillars" },
  "strategy.weeklyCalendar": { de: "Wöchentlicher Kalender", en: "Weekly Calendar" },
  "strategy.postsPerWeek": { de: "Posts / Woche", en: "Posts / Week" },
  "strategy.contentTypesUsed": { de: "Diese Woche verwendete Content Types — aus dem Framework", en: "Content types used this week — from the framework" },

  // Strategy Edit Dialog
  "strategyEdit.title": { de: "Strategie bearbeiten", en: "Edit Strategy" },
  "strategyEdit.primaryGoal": { de: "Primäres Ziel", en: "Primary Goal" },
  "strategyEdit.addPillar": { de: "Pillar hinzufügen", en: "Add Pillar" },
  "strategyEdit.subTopics": { de: "Unter-Themen", en: "Sub-topics" },
  "strategyEdit.noPillars": { de: "Noch keine Pillars — bis zu 5 möglich.", en: "No pillars yet — up to 5 possible." },
  "strategyEdit.weeklyStructure": { de: "Wöchentliche Struktur", en: "Weekly Structure" },
  "strategyEdit.save": { de: "Strategie speichern", en: "Save Strategy" },

  // Scripts Page
  "scripts.draft": { de: "Entwurf", en: "Draft" },
  "scripts.ready": { de: "Bereit", en: "Ready" },
  "scripts.published": { de: "Veröffentlicht", en: "Published" },
  "scripts.untitled": { de: "Unbenanntes Skript", en: "Untitled Script" },
  "scripts.copied": { de: "Kopiert", en: "Copied" },
  "scripts.copyScript": { de: "Skript kopieren", en: "Copy Script" },
  "scripts.apply": { de: "Übernehmen", en: "Apply" },
  "scripts.cancel": { de: "Abbrechen", en: "Cancel" },
  "scripts.changeTopic": { de: "Thema ändern", en: "Change Topic" },
  "scripts.writeScript": { de: "Skript schreiben", en: "Write Script" },
  "scripts.writing": { de: "Skript wird geschrieben…", en: "Writing script…" },
  "scripts.strategyProfile": { de: "Strategie + Profil", en: "Strategy + Profile" },

  // Training Page
  "training.contentFormats": { de: "Content Formate", en: "Content Formats" },
  "training.confirmDelete": { de: "Skript wirklich löschen?", en: "Really delete script?" },
  "training.less": { de: "Weniger", en: "Less" },
  "training.scriptDone": { de: "Skript fertig", en: "Script Done" },
  "training.saved": { de: "Gespeichert", en: "Saved" },

  // Common
  "common.save": { de: "Speichern", en: "Save" },
  "common.cancel": { de: "Abbrechen", en: "Cancel" },
  "common.edit": { de: "Bearbeiten", en: "Edit" },
  "common.delete": { de: "Löschen", en: "Delete" },
  "common.loading": { de: "Laden…", en: "Loading…" },
  "common.more": { de: "Mehr", en: "More" },
  "common.less": { de: "Weniger", en: "Less" },
};

interface I18nContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: "de",
  toggleLang: () => {},
  t: (key: string) => key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("sunxca-lang") as Lang) || "de";
    }
    return "de";
  });

  const toggleLang = useCallback(() => {
    setLang((prev) => {
      const next = prev === "de" ? "en" : "de";
      localStorage.setItem("sunxca-lang", next);
      return next;
    });
  }, []);

  const t = useCallback(
    (key: string) => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[lang];
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
