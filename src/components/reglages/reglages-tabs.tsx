"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CLASSE_ONGLET =
  "h-auto rounded-none border-b-2 border-transparent bg-transparent px-0 pb-3 font-body text-sm text-ink/50 shadow-none data-active:border-accent data-active:bg-transparent data-active:font-medium data-active:text-ink data-active:shadow-none";

/**
 * Navigation par onglets de /reglages - transposition fidèle de la variante
 * « Onglets horizontaux » de reglages.html. L'onglet Administration n'existe
 * que pour les administrateurs (prop optionnelle).
 */
export function ReglagesTabs({
  monCompte,
  briefNotifications,
  administration,
}: {
  monCompte: ReactNode;
  briefNotifications: ReactNode;
  administration?: ReactNode;
}) {
  return (
    <Tabs defaultValue="compte">
      <TabsList
        variant="line"
        className="mb-8 h-auto w-full justify-start gap-6 rounded-none border-b border-ink/5 bg-transparent p-0"
      >
        <TabsTrigger value="compte" className={CLASSE_ONGLET}>
          Mon compte
        </TabsTrigger>
        <TabsTrigger value="brief" className={CLASSE_ONGLET}>
          Brief &amp; notifications
        </TabsTrigger>
        {administration && (
          <TabsTrigger value="admin" className={CLASSE_ONGLET}>
            Administration
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="compte" className="flex flex-col gap-5">
        {monCompte}
      </TabsContent>
      <TabsContent value="brief" className="flex flex-col gap-5">
        {briefNotifications}
      </TabsContent>
      {administration && (
        <TabsContent value="admin" className="flex flex-col gap-5">
          {administration}
        </TabsContent>
      )}
    </Tabs>
  );
}
