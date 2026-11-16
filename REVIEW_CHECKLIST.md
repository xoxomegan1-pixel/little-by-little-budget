# Suggested review checklist

Please review without modifying production data or deploying code.

1. **Security:** Sign-in state and Firestore access rules; verify cross-user isolation.
2. **Data safety:** Import/export, schema changes, lost updates across devices, offline edits.
3. **Budget logic:** Planned / Used / Left / Over; no double-counting transfers as expenses.
4. **Rollovers:** Groceries/travel automatic; discretionary choices monthly; restore hidden categories.
5. **Instalments:** Four consecutive $452 payments then stop (not $452 quarterly);
   distinguish the $150.67/month annual average from near-term cash needed for due dates.
6. **Income:** Normal budgets assume two biweekly paycheques; three-paycheque months
   and refunds count as additional *received* income, not recurring salary.
7. **Opening chequing:** Starting balance isn't new income or fully safe to spend.
8. **TFSA/FHSA:** Calculations depend on the user's verified room and chosen target date.
9. **PWA & accessibility:** Service worker caching, error handling, responsive layout.
10. **Tests:** New/old month, empty data, import legacy backup, offline recovery, and security rules.

Please open review findings as issues or a pull request. Do not include real account data in test cases.
