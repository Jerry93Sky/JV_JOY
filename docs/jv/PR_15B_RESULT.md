# PR_15B: детализация результатов JV

Добавлен отдельный компонент результата и адаптер форматирования: сводка заказа, версии, общий и позиционный BOM, доступные геометрия/раскрой, стекло, покраска, работы, расходники, диагностика и раскрываемый trace с поиском. Данные и суммы берутся из ответа движка; BOM не пересчитывается. PARTIAL не показывает итог заказа. Денежные рациональные значения не округляются через Number. Профиль двери PR_15A не расширяется.

Карта доступности и пропусков: [JV_RESULT_VIEW_MAPPING.md](./JV_RESULT_VIEW_MAPPING.md). Первая нагрузочная оценка и её ограничения: [JV_RESULT_PERFORMANCE_REPORT.md](./JV_RESULT_PERFORMANCE_REPORT.md). Закрытые snapshots и произвольные вложенные объекты не рендерятся; существующий API не заменён безопасной DTO и остаётся доступен только OWNER/ADMIN. Для полноценного завершения необходима отдельная серверная проекция, детальные виды тех семейств, которые сейчас не предоставляют удобные данные, и расширенная приёмка с реальной изолированной БД.

Проверки: backend/frontend build, shared typecheck, 205 JV-тестов, 11 API-тестов, React HTTP, Chrome E2E, 53 fixtures, Line Lab smoke, parity дверного Front, F28 и B26 — PASS локально. Chrome проверяет 7 семейств, оба профиля, COMPLETE/PARTIAL, итог, общий BOM, геометрию и раскрой Line, стекло, поиск по trace, запрет вывода ключа snapshot, пересчёт и ошибку API. Многопроцессное масштабирование и полноценная DB-нагрузка не выполнялись.

## PR_15B.1 — compact result

The UI now uses `JV-RESULT-1`, with server-projected summary and user-bound paginated trace. Legacy output remains for compatibility. See [contract](JV_RESULT_DTO_CONTRACT.md), [security audit](JV_RESULT_SECURITY_AUDIT.md), [R2 performance](JV_RESULT_PERFORMANCE_R2.md) and [multicore plan](JV_MULTICORE_ARCHITECTURE_PLAN.md). Trace handles are per-process and expire; new endpoint does not change the engine. Production capacity, cross-process handles and comprehensive workload benchmarks remain unverified.
