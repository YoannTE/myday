"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  euros,
  eurosSignes,
  libelleMois,
  moisCourt,
  type PointProjection,
} from "@/lib/budget/calculs";

const HAUTEUR = 220;
const MARGE = { gauche: 56, droite: 14, haut: 14, bas: 26 };
const NB_GRADUATIONS = 4;

/** Arrondit un pas d'axe à une valeur « ronde » (1, 2, 2,5 ou 5 × 10ⁿ) :
 *  des graduations à 23 900 € se lisent mal, à 20 000 € elles se lisent. */
function pasArrondi(brut: number): number {
  const puissance = 10 ** Math.floor(Math.log10(brut || 1));
  const facteur = (brut || 1) / puissance;
  const arrondi =
    facteur <= 1 ? 1 : facteur <= 2 ? 2 : facteur <= 2.5 ? 2.5 : facteur <= 5 ? 5 : 10;
  return arrondi * puissance;
}

/**
 * Solde cumulé sur 12 mois — une seule série, donc pas de légende de couleurs
 * (le titre de la carte nomme la donnée). Le survol pose un repère vertical et
 * une infobulle : sur un graphique de trésorerie, la valeur exacte du mois
 * compte autant que la forme de la courbe.
 *
 * Le SVG est redessiné à la largeur réelle du conteneur (pas de `viewBox`
 * étirée) pour que l'épaisseur des traits et la taille du texte restent justes
 * du mobile au grand écran.
 */
export function GraphiqueProjection({ points }: { points: PointProjection[] }) {
  const conteneurRef = useRef<HTMLDivElement>(null);
  const traceRef = useRef<SVGPathElement>(null);
  const [largeur, setLargeur] = useState(640);
  const [survol, setSurvol] = useState<number | null>(null);

  useLayoutEffect(() => {
    const conteneur = conteneurRef.current;
    if (!conteneur) return;
    const mesurer = () => setLargeur(Math.max(280, conteneur.clientWidth));
    mesurer();
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(conteneur);
    return () => observateur.disconnect();
  }, []);

  const interieurL = largeur - MARGE.gauche - MARGE.droite;
  const interieurH = HAUTEUR - MARGE.haut - MARGE.bas;

  const soldes = points.map((point) => point.solde);
  const brutBas = Math.min(0, ...soldes);
  const brutHaut = Math.max(0, ...soldes);
  const pas = pasArrondi((brutHaut - brutBas || 1000) / NB_GRADUATIONS);
  const bas = Math.floor(brutBas / pas) * pas;
  const haut = Math.ceil(brutHaut / pas) * pas + (brutHaut === brutBas ? pas : 0);

  const x = (index: number) =>
    MARGE.gauche +
    (points.length > 1 ? (index / (points.length - 1)) * interieurL : interieurL / 2);
  const y = (valeur: number) =>
    MARGE.haut + ((haut - valeur) / (haut - bas || 1)) * interieurH;

  const graduations: number[] = [];
  for (let valeur = bas; valeur <= haut + 0.001; valeur += pas) {
    graduations.push(valeur);
  }

  const trace = points
    .map((point, index) => `${index ? "L" : "M"}${x(index)} ${y(point.solde)}`)
    .join(" ");
  const aire = `${trace} L${x(points.length - 1)} ${y(Math.max(bas, 0))} L${x(0)} ${y(
    Math.max(bas, 0),
  )} Z`;

  // Le tracé se dessine de gauche à droite au montage : la courbe se lit dans
  // le sens du temps.
  useEffect(() => {
    const chemin = traceRef.current;
    if (!chemin) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const longueur = chemin.getTotalLength();
    const animation = gsap.fromTo(
      chemin,
      { strokeDasharray: longueur, strokeDashoffset: longueur },
      { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" },
    );
    return () => {
      animation.kill();
      gsap.set(chemin, { clearProps: "strokeDasharray,strokeDashoffset" });
    };
  }, [trace]);

  function surDeplacement(evenement: React.MouseEvent<SVGSVGElement>) {
    const cadre = evenement.currentTarget.getBoundingClientRect();
    const position = evenement.clientX - cadre.left;
    const index = Math.round(
      ((position - MARGE.gauche) / (interieurL || 1)) * (points.length - 1),
    );
    setSurvol(Math.max(0, Math.min(points.length - 1, index)));
  }

  const actif = survol === null ? null : points[survol];

  return (
    <div ref={conteneurRef} className="relative px-5 pb-4">
      <svg
        width={largeur}
        height={HAUTEUR}
        viewBox={`0 0 ${largeur} ${HAUTEUR}`}
        className="block w-full overflow-visible"
        role="img"
        aria-label={`Solde projeté sur ${points.length} mois, de ${euros(
          points[0]?.solde ?? 0,
        )} à ${euros(points[points.length - 1]?.solde ?? 0)}`}
        onMouseMove={surDeplacement}
        onMouseLeave={() => setSurvol(null)}
      >
        <defs>
          <linearGradient id="degrade-projection" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {graduations.map((valeur) => (
          <g key={valeur}>
            <line
              x1={MARGE.gauche}
              y1={y(valeur)}
              x2={largeur - MARGE.droite}
              y2={y(valeur)}
              stroke="var(--ink)"
              strokeOpacity="0.07"
            />
            <text
              x={MARGE.gauche - 9}
              y={y(valeur) + 3.5}
              textAnchor="end"
              className="fill-ink/40 font-body text-[10.5px] tabular-nums"
            >
              {new Intl.NumberFormat("fr-FR").format(valeur)}
            </text>
          </g>
        ))}

        {bas < 0 && haut > 0 ? (
          <line
            x1={MARGE.gauche}
            y1={y(0)}
            x2={largeur - MARGE.droite}
            y2={y(0)}
            stroke="var(--destructive)"
            strokeDasharray="3 3"
            strokeOpacity="0.55"
          />
        ) : null}

        <path d={aire} fill="url(#degrade-projection)" />
        <path
          ref={traceRef}
          d={trace}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) =>
          index % 3 === 0 || index === points.length - 1 ? (
            <text
              key={point.cle}
              x={x(index)}
              y={HAUTEUR - 6}
              textAnchor="middle"
              className="fill-ink/40 font-body text-[10.5px]"
            >
              {moisCourt(point.cle)}
            </text>
          ) : null,
        )}

        <circle
          cx={x(points.length - 1)}
          cy={y(points[points.length - 1]?.solde ?? 0)}
          r="4.5"
          fill="var(--card)"
          stroke="var(--accent)"
          strokeWidth="2.5"
        />

        {actif ? (
          <g>
            <line
              x1={x(survol as number)}
              y1={MARGE.haut}
              x2={x(survol as number)}
              y2={MARGE.haut + interieurH}
              stroke="var(--ink)"
              strokeOpacity="0.2"
            />
            <circle
              cx={x(survol as number)}
              cy={y(actif.solde)}
              r="5"
              fill="var(--accent)"
              stroke="var(--card)"
              strokeWidth="2.5"
            />
          </g>
        ) : null}
      </svg>

      {actif ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-inner bg-ink px-3 py-2 text-left shadow-card"
          style={{
            left: Math.min(Math.max(x(survol as number), 78), largeur - 58),
            top: y(actif.solde) - 4,
          }}
        >
          <p className="font-body text-[11px] font-bold text-bg capitalize">
            {libelleMois(actif.cle)}
          </p>
          <p className="mt-0.5 font-body text-[11px] text-bg/70 tabular-nums">
            Solde {eurosSignes(actif.solde)}
          </p>
          <p className="font-body text-[11px] text-bg/70 tabular-nums">
            Mouvement {eurosSignes(actif.mouvement)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
