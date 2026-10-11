import Link from 'next/link';
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  BellAlertIcon,
  BoltIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CircleStackIcon,
  ClockIcon,
  CloudArrowUpIcon,
  CodeBracketIcon,
  CommandLineIcon,
  EyeIcon,
  LifebuoyIcon,
  MagnifyingGlassIcon,
  ShieldExclamationIcon,
  SignalIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';

const responseSteps = [
  {
    number: '01',
    title: 'Détecter',
    description: 'Noter la source du signal et la première heure connue, sans conclure trop vite.',
  },
  {
    number: '02',
    title: 'Cadrer',
    description: 'Production ou dev, un restaurant ou tous, un écran ou toute la plateforme.',
  },
  {
    number: '03',
    title: 'Corréler',
    description: 'Relier heure, release, route et request ID entre les outils.',
  },
  {
    number: '04',
    title: 'Contenir',
    description: 'Réduire le dommage avec la plus petite action réversible.',
  },
  {
    number: '05',
    title: 'Vérifier',
    description: 'Rejouer un parcours sûr, surveiller, puis documenter avant de fermer.',
  },
];

const signalRoutes = [
  {
    source: 'Sentry',
    signal: 'Exception, régression ou erreur front/API',
    firstMove: 'Ouvrir l’événement, confirmer production + release, puis regarder la fréquence et les utilisateurs touchés.',
    nextTool: 'Grafana pour la chronologie et les signaux d’infrastructure.',
    icon: CodeBracketIcon,
  },
  {
    source: 'Grafana',
    signal: 'Latence, 5xx, saturation, base ou disque',
    firstMove: 'Déterminer le service et la fenêtre de temps, puis chercher release, route et request ID corrélés.',
    nextTool: 'Sentry si une exception applicative apparaît ; déploiements si le début suit une release.',
    icon: SignalIcon,
  },
  {
    source: 'Monitor GitHub',
    signal: 'Endpoint public indisponible ou trop lent',
    firstMove: 'Comparer production/dev et ouvrir Operations. Confirmer avec deux contrôles avant toute action.',
    nextTool: 'Déploiements puis Grafana ; le monitor ne donne pas la cause.',
    icon: BellAlertIcon,
  },
  {
    source: 'Message client',
    signal: 'Parcours métier cassé ou comportement intermittent',
    firstMove: 'Collecter restaurant, heure, écran, action et identifiant métier autorisé — jamais mot de passe, carte ou token.',
    nextTool: 'Operations pour l’étendue, puis Sentry/Grafana avec cette fenêtre de temps.',
    icon: UserGroupIcon,
  },
];

const observabilityModules = [
  {
    name: 'Operations Backoffice',
    status: 'Actif',
    statusClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    role: 'Point d’entrée opérateur : disponibilité publique, latence et raccourcis vers les preuves.',
    notFor: 'Ce n’est ni un stockage de logs ni une preuve qu’un parcours de paiement complet fonctionne.',
    icon: EyeIcon,
  },
  {
    name: 'Monitor GitHub Actions',
    status: 'Planifié actif',
    statusClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    role: 'Sonde extérieure exécutée toutes les cinq minutes. Un mode de simulation manuel teste la création, l’assignation et la clôture de l’incident sans couper de service.',
    notFor: 'Il confirme un symptôme réseau/HTTP, pas la cause profonde, et ne doit pas être l’unique alerte.',
    icon: BellAlertIcon,
  },
  {
    name: 'Sentry',
    status: 'À configurer',
    statusClass: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    role: 'Regroupe les exceptions, montre la stack trace, la release fautive et les régressions.',
    notFor: 'Il ne remplace pas les métriques d’infrastructure, les logs centralisés ou une sonde externe.',
    icon: CodeBracketIcon,
  },
  {
    name: 'Grafana Cloud',
    status: 'À configurer',
    statusClass: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    role: 'Met au même endroit logs structurés, métriques, latence, 5xx, ressources et alertes.',
    notFor: 'Il ne groupe pas les bugs par stack trace aussi efficacement que Sentry.',
    icon: SignalIcon,
  },
  {
    name: 'OpenTelemetry / Alloy',
    status: 'Étape suivante',
    statusClass: 'bg-gray-100 text-gray-600 ring-gray-500/20',
    role: 'Collecte et transporte logs, métriques et traces avec IDs corrélés vers Grafana ou un autre fournisseur.',
    notFor: 'C’est la plomberie de télémétrie, pas l’écran utilisé pendant un incident.',
    icon: CloudArrowUpIcon,
  },
  {
    name: 'GitHub Deployments',
    status: 'Actif',
    statusClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    role: 'Répond à « qu’est-ce qui a changé ? » : commit, build, déploiement, promotion et retour arrière.',
    notFor: 'Un workflow vert ne garantit pas à lui seul l’absence de régression métier.',
    icon: CommandLineIcon,
  },
  {
    name: 'Backups / stockage hors hôte',
    status: 'Partiel',
    statusClass: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    role: 'Permet de restaurer les données après corruption, suppression ou perte du serveur.',
    notFor: 'Un fichier présent n’est pas une sauvegarde fiable sans test de restauration et copie hors serveur.',
    icon: CircleStackIcon,
  },
];

const serviceMap = [
  ['API Foody', 'Authentification, commandes, menus, paiements, WebSocket et règles métier.', 'Santé, 5xx, p95, erreurs DB, callbacks paiement.'],
  ['Guest web', 'Site public et commande QR du client final.', 'Disponibilité, erreurs JS, temps de chargement, appels API.'],
  ['Admin restaurant', 'Gestion du menu, des commandes et des paramètres par le restaurateur.', 'Connexion, erreurs JS/API, droits et restaurant_id.'],
  ['POS', 'Prise en charge opérationnelle des commandes par le personnel.', 'Réception WebSocket, synchronisation, version installée, connectivité locale.'],
  ['Backoffice', 'Outil interne Foody pour support, configuration et supervision.', 'Connexion superadmin, erreurs JS/API, disponibilité Operations.'],
  ['PostgreSQL', 'Source de vérité persistante : restaurants, commandes et configuration.', 'Connexions, requêtes lentes, verrous, espace disque, sauvegardes.'],
  ['Redis', 'État éphémère, cache et coordination selon les flux API.', 'Disponibilité, mémoire, latence et évictions.'],
  ['Chrome headless', 'Rendu serveur de documents ou impressions nécessitant un navigateur.', 'Échecs de rendu, crashs, mémoire et temps de génération.'],
  ['Paiements restaurant', 'Prestataire choisi et financé par chaque restaurateur, par exemple Sumit.', 'Callback, signature, statut interne et configuration du restaurant.'],
  ['WhatsApp restaurant', 'Foody est Tech Provider : chaque restaurateur connecte son portefeuille Meta, sa WABA et son sender dans un sous-compte Twilio dédié, et supporte sa consommation.', 'État de l’onboarding, sous-compte, WABA, sender ONLINE, callbacks et erreurs Twilio du restaurant.'],
  ['Landing', 'Site public de présentation de Foody.', 'Disponibilité et performance ; impact commercial, pas transactionnel.'],
];

const scenarios = [
  {
    title: 'Sentry déclenche une alerte de régression',
    badge: 'Erreur applicative',
    tone: 'text-violet-700 bg-violet-50 ring-violet-600/20',
    steps: [
      'Confirmer que l’événement vient de production et relever la première occurrence, la release et la route.',
      'Mesurer l’impact : volume, nouveaux événements, restaurants touchés et parcours concerné. Ne pas copier les données utilisateur.',
      'Dans Grafana, examiner la même fenêtre de temps avec release, route, request ID, taux de 5xx et dépendances.',
      'Si la corrélation avec une release est forte, arrêter les promotions et revenir à l’image immuable précédente ; sinon désactiver uniquement la fonctionnalité fautive si possible.',
      'Vérifier le parcours sûr, le taux d’erreur et l’absence de nouvelle occurrence avant de résoudre l’alerte.',
    ],
  },
  {
    title: 'Grafana signale une hausse de 5xx ou de latence',
    badge: 'Service dégradé',
    tone: 'text-amber-700 bg-amber-50 ring-amber-600/20',
    steps: [
      'Identifier le service, la route, l’environnement et l’heure de début. Vérifier si le signal concerne tous les restaurants.',
      'Comparer avec CPU, mémoire, disque, connexions PostgreSQL, Redis et dernière release.',
      'Ouvrir Sentry si les logs pointent vers une exception. Séparer capacité, dépendance externe et bug applicatif.',
      'Contenir la plus petite zone : rollback validé, limitation d’un flux ou redémarrage ciblé uniquement avec une raison établie.',
      'Surveiller au moins une fenêtre complète d’alerte après retour à la normale.',
    ],
  },
  {
    title: 'Le monitor GitHub ouvre une issue d’indisponibilité',
    badge: 'Disponibilité',
    tone: 'text-red-700 bg-red-50 ring-red-600/20',
    steps: [
      'Ouvrir Operations et relancer une vérification. Comparer production et développement.',
      'Consulter le dernier déploiement et vérifier si la panne a commencé juste après sa promotion.',
      'Regarder Grafana pour réseau, 5xx, latence et ressources. Le monitor externe indique le symptôme, pas la cause.',
      'Traiter en SEV-1 si le checkout, l’API ou la réception de commandes est indisponible en production.',
      'Laisser l’automatisation fermer l’issue après rétablissement, puis ajouter la cause et les actions de prévention.',
    ],
  },
  {
    title: 'Un restaurateur ou un client signale un bug',
    badge: 'Support',
    tone: 'text-blue-700 bg-blue-50 ring-blue-600/20',
    steps: [
      'Demander le restaurant, l’heure avec fuseau, l’écran, l’action, le résultat attendu et un identifiant de commande si nécessaire.',
      'Ne jamais demander mot de passe, OTP, numéro de carte, clé API, cookie ou token. Éviter les captures contenant des données client.',
      'Vérifier d’abord l’étendue dans Operations, puis chercher la fenêtre de temps dans Sentry et Grafana.',
      'Reproduire avec des données synthétiques ou sur dev. Ne pas rejouer une opération financière réelle.',
      'Répondre avec impact, contournement sûr et délai de prochain point — sans spéculation technique.',
    ],
  },
  {
    title: 'Paiement Sumit accepté/refusé de façon inattendue',
    badge: 'Paiement',
    tone: 'text-rose-700 bg-rose-50 ring-rose-600/20',
    steps: [
      'Confirmer le restaurant, la commande, le statut interne et l’heure. Les accès Sumit appartiennent au restaurateur.',
      'Vérifier la configuration du restaurant et le callback avec des références internes autorisées, jamais la clé API ou les données carte.',
      'Ne jamais marquer une commande payée manuellement sur la seule base d’un message client.',
      'Un test réel n’est possible qu’avec accord explicite du restaurateur sur le montant, le remboursement et la fenêtre de test.',
      'Réconcilier le statut Foody avec le prestataire, documenter toute action financière et vérifier qu’une commande impayée n’est pas diffusée au POS.',
    ],
  },
  {
    title: 'Alerte Twilio ou message WhatsApp non envoyé',
    badge: 'Communication tenant',
    tone: 'text-sky-700 bg-sky-50 ring-sky-600/20',
    steps: [
      'Identifier le restaurant, la notification, l’heure et le code Twilio. Ne jamais copier numéro de téléphone, Auth Token ou contenu client dans le ticket.',
      'Foody est Tech Provider : confirmer que ce restaurant a terminé Meta Embedded Signup et possède sa WABA, son sous-compte Twilio dédié et un sender ONLINE.',
      'Pour une erreur 63007, vérifier que le sender et les identifiants utilisés appartiennent au même sous-compte du restaurant. Ne pas réparer ou utiliser un sender global Foody comme fallback.',
      'Si le restaurant n’est pas connecté ou si son sender n’est pas ONLINE, suspendre uniquement ses envois WhatsApp et lui faire terminer son onboarding ; les autres restaurants ne doivent pas être touchés.',
      'Un message réel de validation nécessite l’accord du restaurateur et un destinataire consentant. Vérifier ensuite le callback de statut et l’absence de nouvelle erreur.',
    ],
  },
  {
    title: 'Une commande payée n’apparaît pas sur le POS',
    badge: 'Commande',
    tone: 'text-orange-700 bg-orange-50 ring-orange-600/20',
    steps: [
      'Vérifier payment_status puis le statut de commande. Une commande impayée ne doit volontairement pas être diffusée.',
      'Confirmer que le callback a été validé et que l’événement commande a été émis pour le bon restaurant_id.',
      'Contrôler la connexion WebSocket, les filtres du POS et la version de l’application.',
      'Ne pas dupliquer la commande pour forcer son apparition. Réémettre uniquement via un mécanisme idempotent et validé.',
      'Vérifier sur un seul restaurant avant d’élargir l’action.',
    ],
  },
  {
    title: 'Une alerte indique qu’aucune sauvegarde récente n’existe',
    badge: 'Récupération',
    tone: 'text-cyan-700 bg-cyan-50 ring-cyan-600/20',
    steps: [
      'Suspendre toute promotion ou migration risquée jusqu’au rétablissement de la chaîne de sauvegarde.',
      'Vérifier le job, l’espace disque, la taille du fichier et son intégrité gzip sans afficher de données.',
      'Créer une sauvegarde contrôlée, puis effectuer un test de restauration isolé.',
      'Confirmer qu’une copie chiffrée hors serveur existe ; sinon l’incident reste ouvert même si le fichier local est sain.',
      'Documenter le dernier point de restauration réellement vérifié.',
    ],
  },
  {
    title: 'Une clé, un token ou une donnée sensible pourrait avoir fuité',
    badge: 'Sécurité',
    tone: 'text-red-800 bg-red-50 ring-red-700/20',
    steps: [
      'Traiter immédiatement en SEV-1 et limiter l’accès aux personnes nécessaires.',
      'Préserver l’heure, la source et les métadonnées sans recopier la valeur sensible dans un ticket ou un chat.',
      'Révoquer puis remplacer le secret auprès de son propriétaire ; pour un prestataire de paiement, coordonner avec le restaurateur.',
      'Rechercher l’usage anormal et supprimer l’exposition publique sans détruire les preuves utiles.',
      'Vérifier les nouveaux accès, corriger la cause de journalisation ou de configuration et consigner la rotation.',
    ],
  },
];

const toolLinks = [
  ['Sentry', process.env.NEXT_PUBLIC_SENTRY_DASHBOARD_URL],
  ['Grafana', process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_URL],
  ['Déploiements', process.env.NEXT_PUBLIC_GITHUB_ACTIONS_URL],
] as const;

export default function IncidentGuidePage() {
  return (
    <div className="space-y-8 pb-12">
      <header className="overflow-hidden rounded-2xl bg-[#1a1a2e] text-white">
        <div className="grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-8">
          <div>
            <Link
              href="/dashboard/operations"
              className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-orange-300 hover:text-orange-200 focus:outline-none focus:ring-2 focus:ring-orange-300"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Retour au statut en direct
            </Link>
            <div className="flex items-center gap-3">
              <LifebuoyIcon className="h-7 w-7 text-orange-400" />
              <h1 className="text-2xl font-bold">Guide de réponse aux incidents</h1>
            </div>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
              Quel que soit le point d’entrée — Sentry, Grafana, monitor GitHub ou message client — commence par cadrer l’impact, rassemble des preuves sûres et choisis l’action réversible la plus petite.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
            {toolLinks.map(([name, href]) => href ? (
              <a
                key={name}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-orange-300"
              >
                {name}
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              </a>
            ) : (
              <span key={name} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-500">
                {name} non configuré
              </span>
            ))}
          </div>
        </div>
        <div className="grid border-t border-white/10 sm:grid-cols-3">
          <div className="border-b border-white/10 bg-red-500/15 px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-xs font-bold uppercase tracking-wider text-red-300">SEV-1 · immédiat</p>
            <p className="mt-1 text-sm text-gray-200">Commandes, paiement, données ou sécurité à risque.</p>
          </div>
          <div className="border-b border-white/10 bg-amber-500/10 px-5 py-4 sm:border-b-0 sm:border-r">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">SEV-2 · rapide</p>
            <p className="mt-1 text-sm text-gray-200">Dégradation limitée à un flux ou à certains restaurants.</p>
          </div>
          <div className="bg-sky-500/10 px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-wider text-sky-300">SEV-3 · planifié</p>
            <p className="mt-1 text-sm text-gray-200">Anomalie sans impact client immédiat.</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="response-path-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Réflexe commun</p>
            <h2 id="response-path-heading" className="mt-1 text-xl font-bold text-gray-900">Le même parcours, quelle que soit l’alerte</h2>
          </div>
          <span className="hidden text-xs text-gray-500 md:block">Objectif : une première décision en moins de 10 minutes</span>
        </div>
        <ol className="relative grid overflow-hidden rounded-xl border border-gray-200 bg-white md:grid-cols-5">
          {responseSteps.map((step, index) => (
            <li key={step.number} className="relative border-b border-gray-100 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-brand-600">{step.number}</span>
                {index < responseSteps.length - 1 && <span aria-hidden="true" className="hidden h-px w-8 bg-orange-200 md:block" />}
              </div>
              <h3 className="text-sm font-bold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-xs leading-5 text-gray-600">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="entry-point-heading" className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 id="entry-point-heading" className="font-bold text-gray-900">Par où commencer ?</h2>
            <p className="mt-1 text-sm text-gray-500">Le canal change la première preuve à ouvrir, pas la méthode.</p>
          </div>
          <div className="divide-y divide-gray-100">
            {signalRoutes.map((route) => (
              <article key={route.source} className="grid gap-3 p-5 sm:grid-cols-[11rem_1fr]">
                <div>
                  <route.icon className="h-5 w-5 text-brand-600" />
                  <h3 className="mt-2 text-sm font-bold text-gray-900">{route.source}</h3>
                  <p className="mt-1 text-xs text-gray-500">{route.signal}</p>
                </div>
                <div className="text-sm leading-6 text-gray-700">
                  <p><strong>Premier geste :</strong> {route.firstMove}</p>
                  <p className="mt-1 text-gray-500"><strong className="text-gray-700">Ensuite :</strong> {route.nextTool}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="rounded-xl border border-red-200 bg-red-50/60 p-5">
          <ShieldExclamationIcon className="h-6 w-6 text-red-600" />
          <h2 className="mt-3 font-bold text-gray-900">Garde-fous production</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
            <li><strong>Pas de redémarrage à l’aveugle.</strong> Il efface du contexte et peut amplifier la panne.</li>
            <li><strong>Pas d’édition directe en base</strong> comme première réponse.</li>
            <li><strong>Pas de secret dans les tickets :</strong> token, clé API, OTP, carte, cookie ou corps de requête.</li>
            <li><strong>Pas de paiement réel de test</strong> sans accord du restaurateur sur montant et remboursement.</li>
            <li><strong>Pas de fallback Twilio global :</strong> un restaurant sans sender ONLINE reste désactivé jusqu’à la fin de son onboarding.</li>
            <li><strong>Pas de fermeture</strong> sans parcours vérifié et fenêtre d’observation.</li>
          </ul>
        </aside>
      </section>

      <section aria-labelledby="tools-heading">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Boîte à outils</p>
          <h2 id="tools-heading" className="mt-1 text-xl font-bold text-gray-900">Pourquoi chaque module existe</h2>
          <p className="mt-1 text-sm text-gray-500">Les statuts décrivent la situation actuelle de Foody, pas une promesse de configuration.</p>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="divide-y divide-gray-100">
            {observabilityModules.map((module) => (
              <article key={module.name} className="grid gap-4 p-5 md:grid-cols-[14rem_1fr_1fr] md:items-start">
                <div className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                    <module.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">{module.name}</h3>
                    <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${module.statusClass}`}>
                      {module.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Son rôle</p>
                  <p className="mt-1 text-sm leading-6 text-gray-700">{module.role}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Ce qu’il ne remplace pas</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{module.notFor}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="services-heading">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Carte Foody</p>
          <h2 id="services-heading" className="mt-1 text-xl font-bold text-gray-900">Quel service regarder ?</h2>
        </div>
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-3">Service</th>
                <th className="px-5 py-3">Responsabilité</th>
                <th className="px-5 py-3">Premiers signaux</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {serviceMap.map(([service, responsibility, signals]) => (
                <tr key={service} className="align-top hover:bg-gray-50/70">
                  <th scope="row" className="whitespace-nowrap px-5 py-4 text-left font-bold text-gray-900">{service}</th>
                  <td className="min-w-72 px-5 py-4 leading-6 text-gray-700">{responsibility}</td>
                  <td className="min-w-72 px-5 py-4 leading-6 text-gray-600">{signals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="scenarios-heading">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600">Runbooks</p>
          <h2 id="scenarios-heading" className="mt-1 text-xl font-bold text-gray-900">Scénarios concrets</h2>
          <p className="mt-1 text-sm text-gray-500">Ouvre le scénario qui ressemble au signal reçu, puis adapte l’action à l’impact réel.</p>
        </div>
        <div className="space-y-3">
          {scenarios.map((scenario, index) => (
            <details key={scenario.title} className="group overflow-hidden rounded-xl border border-gray-200 bg-white open:border-brand-200">
              <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400 [&::-webkit-details-marker]:hidden">
                <span className="font-mono text-xs font-bold text-gray-400">{String(index + 1).padStart(2, '0')}</span>
                <span className="flex-1 text-sm font-bold text-gray-900">{scenario.title}</span>
                <span className={`hidden rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset sm:inline-flex ${scenario.tone}`}>{scenario.badge}</span>
                <ChevronDownIcon className="h-4 w-4 text-gray-400 transition group-open:rotate-180" />
              </summary>
              <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-5 sm:pl-14">
                <ol className="space-y-3">
                  {scenario.steps.map((step, stepIndex) => (
                    <li key={step} className="flex gap-3 text-sm leading-6 text-gray-700">
                      <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-brand-600 ring-1 ring-gray-200">
                        {stepIndex + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="incident-note-heading" className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-xl bg-[#1a1a2e] p-6 text-white">
          <ClockIcon className="h-6 w-6 text-orange-400" />
          <h2 id="incident-note-heading" className="mt-3 font-bold">Quand fermer un incident ?</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-300">
            <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />Le parcours touché fonctionne à nouveau.</li>
            <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />Les alertes restent normales pendant une fenêtre complète.</li>
            <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />La cause ou l’hypothèse est documentée avec preuves.</li>
            <li className="flex gap-2"><CheckCircleIcon className="mt-1 h-4 w-4 shrink-0 text-emerald-400" />Une action préventive a un propriétaire et une échéance.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <MagnifyingGlassIcon className="h-5 w-5 text-brand-600" />
            <h2 className="font-bold text-gray-900">Note d’incident minimale</h2>
          </div>
          <p className="mt-2 text-sm text-gray-500">Copie cette structure dans l’issue, sans données personnelles ni secrets.</p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs leading-6 text-gray-300"><code>{`Sévérité / propriétaire :
Début / détection / rétablissement :
Impact client et restaurants concernés :
Signal initial et étendue confirmée :
Release, route et request IDs autorisés :
Action de confinement :
Vérification effectuée :
Cause ou hypothèse étayée :
Suivi / responsable / échéance :`}</code></pre>
        </div>
      </section>

      <footer className="flex flex-col gap-3 rounded-xl border border-orange-200 bg-[#fffaf5] p-5 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <BoltIcon className="h-5 w-5 shrink-0 text-orange-600" />
          <p><strong>En doute :</strong> protège d’abord les commandes, les paiements et les données, puis demande une seconde vérification avant une mutation production.</p>
        </div>
        <Link href="/dashboard/operations" className="whitespace-nowrap font-bold text-brand-600 hover:text-brand-700">Voir le statut →</Link>
      </footer>
    </div>
  );
}
