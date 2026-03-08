export default function NewClientPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center space-y-2">
        <p className="text-lg font-semibold">Noch keine Clients</p>
        <p className="text-sm text-muted-foreground">
          Klicke auf &ldquo;Neuer Client&rdquo; in der Sidebar um zu starten.
        </p>
      </div>
    </div>
  );
}
