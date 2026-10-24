import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
  Image,
} from '@react-pdf/renderer';
import { Player, Quiz, PlayerAnswer } from '@/types';

// ── Helpers ────────────────────────────────────────────────────────────────
/**
 * JEE/NEET percentile formula:
 *   Percentile = (Number of candidates with score STRICTLY LESS than you / Total candidates) × 100
 *
 * This gives:
 *   - Last place (lowest score): 0.00  (nobody scored less)
 *   - Top scorer (highest unique score): close to 100 but calculated from below
 *   - If multiple candidates share the top score: all get the same percentile
 *
 * Example with 8 players (scores: 60, 52, 48, 48, 48, 20, 0, 0):
 *   Score 60 → 7 scored less → (7/8)×100 = 87.5   ... but NTA caps top at 100
 *   Actually NTA uses: percentile of topper = 100 always (special case)
 *
 * We use the strict NTA formula:
 *   percentile = ((candidates with score < yours) / total) × 100
 *   But the topper group gets 100 by convention.
 */
const jeePercentile = (score: number, allScores: number[]): number => {
  const n = allScores.length;
  if (n === 0) return 0;
  const maxScore = Math.max(...allScores);
  // Top scorers always get 100
  if (score >= maxScore) return 100;
  // Count how many scored strictly less
  const below = allScores.filter(s => s < score).length;
  return Number(((below / n) * 100).toFixed(2));
};

// ── Types ──────────────────────────────────────────────────────────────────
interface PlayerData {
  id: string;
  uid?: string;
  nickname: string;
  avatar: string;
  score: number;
  answers?: PlayerAnswer[];
  percentile?: number;
  joinedAt?: string;
  completedAt?: string;
  correctAnswersCount?: number;
  totalQuestions?: number;
}

export interface GameResultsPDFProps {
  players: PlayerData[];
  quiz: Quiz | null;
  totalQuestions?: number;
}

// ── Styles ─────────────────────────────────────────────────────────────────
const C = {
  indigo900: '#1e1b4b',
  indigo700: '#4338ca',
  indigo200: '#c7d2fe',
  white:     '#ffffff',
  gray50:    '#f9fafb',
  gray100:   '#f3f4f6',
  gray200:   '#e5e7eb',
  gray400:   '#9ca3af',
  gray600:   '#4b5563',
  gray700:   '#374151',
  green500:  '#22c55e',
  green50:   '#f0fdf4',
  red500:    '#ef4444',
  yellow400: '#facc15',
  amber600:  '#d97706',
  violet500: '#8b5cf6',
};

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: C.white,
    paddingBottom: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  // ── Header ──
  header: {
    backgroundColor: C.indigo900,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  headerTitle: {
    color: C.white,
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
  },
  headerSubtitle: {
    color: C.indigo200,
    fontSize: 8,
    marginTop: 2,
  },
  headerDate: {
    color: C.indigo200,
    fontSize: 8,
    textAlign: 'right',
  },
  // ── Quiz info bar ──
  quizBar: {
    backgroundColor: C.gray100,
    paddingVertical: 7,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: C.gray200,
  },
  quizTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: C.gray700,
  },
  quizMeta: {
    fontSize: 8,
    color: C.gray400,
    marginTop: 1,
  },
  // ── Summary boxes ──
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
    gap: 8,
  },
  summaryBox: {
    flex: 1,
    backgroundColor: C.gray50,
    borderWidth: 1,
    borderColor: C.gray200,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: C.indigo700,
  },
  summaryLabel: {
    fontSize: 7,
    color: C.gray400,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  // ── Section heading ──
  sectionHeading: {
    backgroundColor: C.indigo900,
    marginHorizontal: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 4,
    marginBottom: 4,
  },
  sectionHeadingText: {
    color: C.white,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Table ──
  table: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: C.gray200,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: C.indigo900,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: C.gray200,
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: C.gray50,
  },
  tableRowTop3: {
    backgroundColor: '#fefce8', // yellow-50
  },
  thText: {
    color: C.white,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
  },
  tdText: {
    fontSize: 8.5,
    color: C.gray700,
    textAlign: 'center',
  },
  // Column widths
  colRank:     { width: '8%' },
  colPlayer:   { width: '30%', textAlign: 'left' },
  colScore:    { width: '15%' },
  colCorrect:  { width: '18%' },
  colAccuracy: { width: '15%' },
  colPct:      { width: '14%' },
  // ── Medal badge ──
  medalBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  medalText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  playerName: {
    fontSize: 8.5,
    color: C.gray700,
    flex: 1,
  },
  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.indigo900,
    paddingVertical: 7,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    color: C.indigo200,
    fontSize: 7,
  },
  footerCreator: {
    color: C.white,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
});

// ── Document ───────────────────────────────────────────────────────────────
export const GameResultsDocument: React.FC<GameResultsPDFProps> = ({
  players,
  quiz,
  totalQuestions: propTotalQuestions,
}) => {
  const totalQuestions =
    propTotalQuestions ||
    quiz?.totalQuestions ||
    quiz?.questions?.length ||
    Math.max(...players.map((p) => p.totalQuestions || 0), 0);

  // ── Build enriched player list with JEE/NEET percentile ────────────────
  // JEE/NEET formula: percentile = (candidates with score STRICTLY LESS / total) × 100
  // Top scorer(s) always get 100. Last scorer(s) always get 0.
  const allPlayerScores = players.map((p) => p.score);

  const sorted = [...players]
    .map((player) => {
      const correctAnswers =
        player.correctAnswersCount ||
        player.answers?.filter((a) => a.correct).length ||
        0;
      const accuracy =
        totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

      // Count how many players scored strictly less than this player
      const below    = allPlayerScores.filter((s) => s < player.score).length;
      const maxScore = Math.max(...allPlayerScores);
      // Toppers always 100; everyone else = (below / total) × 100
      const percentile =
        player.score >= maxScore
          ? 100
          : Number(((below / allPlayerScores.length) * 100).toFixed(2));

      return { ...player, correctAnswers, accuracy: +accuracy.toFixed(1), percentile };
    })
    .sort((a, b) =>
      b.score !== a.score ? b.score - a.score : b.accuracy - a.accuracy,
    );

  const n        = sorted.length;
  const enriched = sorted;
  const avgAccuracy =
    enriched.length > 0
      ? enriched.reduce((s, p) => s + p.accuracy, 0) / enriched.length
      : 0;

  const topScore = enriched[0]?.score ?? 0;
  const today = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image src="/msplogo.jpg" style={styles.logo} />
            <View>
              <Text style={styles.headerTitle}>PCCOER Education Platform</Text>
              <Text style={styles.headerSubtitle}>Game Results Report  ·  Digras</Text>
            </View>
          </View>
          <Text style={styles.headerDate}>{today}</Text>
        </View>

        {/* ── Quiz info bar ── */}
        <View style={styles.quizBar}>
          <View>
            <Text style={styles.quizTitle}>{quiz?.title || 'Quiz Results'}</Text>
            <Text style={styles.quizMeta}>Total Questions: {totalQuestions}</Text>
          </View>
          <View>
            <Text style={[styles.quizMeta, { textAlign: 'right' }]}>
              Participants: {enriched.length}
            </Text>
            <Text style={[styles.quizMeta, { textAlign: 'right' }]}>
              Top Score: {topScore}
            </Text>
          </View>
        </View>

        {/* ── Summary boxes ── */}
        <View style={styles.summaryRow}>
          {[
            { label: 'Participants',    value: String(enriched.length) },
            { label: 'Avg Accuracy',    value: `${avgAccuracy.toFixed(1)}%` },
            { label: 'Total Questions', value: String(totalQuestions) },
            { label: 'Top Score',       value: String(topScore) },
          ].map((item) => (
            <View key={item.label} style={styles.summaryBox}>
              <Text style={styles.summaryValue}>{item.value}</Text>
              <Text style={styles.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Leaderboard heading ── */}
        <View style={styles.sectionHeading}>
          <Text style={styles.sectionHeadingText}>Leaderboard</Text>
        </View>

        {/* ── Table ── */}
        <View style={styles.table}>
          {/* Header row */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.thText, styles.colRank]}>Rank</Text>
            <Text style={[styles.thText, styles.colPlayer]}>Player</Text>
            <Text style={[styles.thText, styles.colScore]}>Score</Text>
            <Text style={[styles.thText, styles.colCorrect]}>Correct</Text>
            <Text style={[styles.thText, styles.colAccuracy]}>Accuracy</Text>
            <Text style={[styles.thText, styles.colPct]}>Percentile</Text>
          </View>

          {enriched.map((player, idx) => {
            const medalColors = ['#d97706', '#64748b', '#92400e'];
            const isTop3 = idx < 3;
            return (
              <View
                key={player.id || `player-${idx}`}
                style={[
                  styles.tableRow,
                  idx % 2 !== 0 ? styles.tableRowAlt : {},
                  isTop3 ? styles.tableRowTop3 : {},
                ]}
              >
                {/* Rank */}
                <View style={[styles.colRank, { alignItems: 'center' }]}>
                  {isTop3 ? (
                    <View
                      style={[
                        styles.medalBadge,
                        { backgroundColor: medalColors[idx] },
                      ]}
                    >
                      <Text style={styles.medalText}>{idx + 1}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.tdText, { color: C.gray400 }]}>
                      {idx + 1}
                    </Text>
                  )}
                </View>

                {/* Player name */}
                <Text style={[styles.playerName, styles.colPlayer]}>
                  {player.nickname}
                </Text>

                {/* Score */}
                <Text
                  style={[
                    styles.tdText,
                    styles.colScore,
                    isTop3
                      ? { color: C.indigo700, fontFamily: 'Helvetica-Bold' }
                      : {},
                  ]}
                >
                  {player.score}
                </Text>

                {/* Correct */}
                <Text style={[styles.tdText, styles.colCorrect]}>
                  {player.correctAnswers}/{totalQuestions}
                </Text>

                {/* Accuracy */}
                <Text
                  style={[
                    styles.tdText,
                    styles.colAccuracy,
                    { color: player.accuracy >= 50 ? C.green500 : C.red500 },
                  ]}
                >
                  {player.accuracy}%
                </Text>

                {/* Percentile */}
                <Text style={[styles.tdText, styles.colPct]}>
                  {player.percentile}%
                </Text>
              </View>
            );
          })}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            PCCOER Education Platform  ·  Auto-generated
          </Text>
          <Text style={styles.footerCreator}>Created by Mr. Suraj Zalke</Text>
        </View>
      </Page>
    </Document>
  );
};

// ── Download button ────────────────────────────────────────────────────────
export const GameResultsDownloadButton: React.FC<GameResultsPDFProps> = (props) => (
  <PDFDownloadLink
    document={<GameResultsDocument {...props} />}
    fileName={`game-results-${new Date().toISOString().split('T')[0]}.pdf`}
    className="inline-flex items-center justify-center rounded-md text-sm font-medium
               bg-[#1e1b4b] text-white hover:bg-[#4338ca] h-10 px-4 py-2
               transition-colors focus-visible:outline-none focus-visible:ring-2
               focus-visible:ring-indigo-500 focus-visible:ring-offset-2
               disabled:pointer-events-none disabled:opacity-50"
  >
    {({ loading }) => (loading ? 'Preparing PDF…' : '⬇ Download Results PDF')}
  </PDFDownloadLink>
);
