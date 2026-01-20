# Sarthi AI Project Structure

The diagram below captures the repository layout from the workspace root, focusing on source-controlled assets. Generated directories such as `.git`, `backend/.pgdata`, `mobile/node_modules`, caches, and `__pycache__` folders are omitted for readability.

```text
├── .gitignore
├── .python-version
├── README.md
├── backend
│   ├── .env
│   ├── .env.example
│   ├── alembic
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions
│   │       ├── 202401061200_add_user_preferences.py
│   │       └── 202410041200_initial_schema.py
│   ├── alembic.ini
│   ├── app
│   │   ├── __init__.py
│   │   ├── api
│   │   │   ├── __init__.py
│   │   │   ├── routes
│   │   │   │   ├── agent_log.py
│   │   │   │   ├── brain_dump.py
│   │   │   │   ├── dashboard.py
│   │   │   │   ├── interventions.py
│   │   │   │   ├── jobs.py
│   │   │   │   ├── notifications.py
│   │   │   │   ├── preferences.py
│   │   │   │   ├── resolution.py
│   │   │   │   ├── resolutions_approve.py
│   │   │   │   ├── resolutions_decompose.py
│   │   │   │   ├── resolutions_intake.py
│   │   │   │   ├── task.py
│   │   │   │   └── weekly_plan.py
│   │   │   └── schemas
│   │   │       ├── agent_log.py
│   │   │       ├── approval.py
│   │   │       ├── brain_dump.py
│   │   │       ├── dashboard.py
│   │   │       ├── decomposition.py
│   │   │       ├── interventions.py
│   │   │       ├── jobs.py
│   │   │       ├── preferences.py
│   │   │       ├── resolution.py
│   │   │       ├── task.py
│   │   │       └── weekly_plan.py
│   │   ├── core
│   │   │   ├── __init__.py
│   │   │   ├── config.py
│   │   │   ├── context.py
│   │   │   ├── logging.py
│   │   │   └── middleware.py
│   │   ├── db
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── deps.py
│   │   │   ├── models
│   │   │   │   ├── __init__.py
│   │   │   │   ├── agent_action_log.py
│   │   │   │   ├── brain_dump.py
│   │   │   │   ├── resolution.py
│   │   │   │   ├── task.py
│   │   │   │   ├── user.py
│   │   │   │   └── user_preferences.py
│   │   │   ├── session.py
│   │   │   └── types.py
│   │   ├── main.py
│   │   ├── observability
│   │   │   ├── __init__.py
│   │   │   ├── client.py
│   │   │   ├── metrics.py
│   │   │   └── tracing.py
│   │   ├── services
│   │   │   ├── brain_dump_extractor.py
│   │   │   ├── dashboard_service.py
│   │   │   ├── intervention_service.py
│   │   │   ├── job_runner.py
│   │   │   ├── notifications
│   │   │   │   ├── base.py
│   │   │   │   ├── factory.py
│   │   │   │   ├── hooks.py
│   │   │   │   └── noop.py
│   │   │   ├── preferences_service.py
│   │   │   ├── resolution_approval.py
│   │   │   ├── resolution_decomposer.py
│   │   │   ├── resolution_intake.py
│   │   │   ├── resolution_tasks.py
│   │   │   ├── user_service.py
│   │   │   └── weekly_planner.py
│   │   └── worker
│   │       └── scheduler_main.py
│   ├── sarthiai_backend.egg-info
│   │   ├── PKG-INFO
│   │   ├── SOURCES.txt
│   │   ├── dependency_links.txt
│   │   ├── requires.txt
│   │   └── top_level.txt
│   ├── pyproject.toml
│   └── tests
│       ├── __init__.py
│       ├── test_agent_log_api.py
│       ├── test_app_routes.py
│       ├── test_brain_dump_api.py
│       ├── test_dashboard_api.py
│       ├── test_health.py
│       ├── test_interventions_history.py
│       ├── test_interventions_preview.py
│       ├── test_interventions_run_latest.py
│       ├── test_job_runner.py
│       ├── test_jobs_routes.py
│       ├── test_metrics.py
│       ├── test_models.py
│       ├── test_notifications.py
│       ├── test_observability.py
│       ├── test_observability_enabled.py
│       ├── test_preferences_api.py
│       ├── test_resolution_api.py
│       ├── test_resolution_approve_api.py
│       ├── test_resolution_decompose_api.py
│       ├── test_resolution_get_api.py
│       ├── test_scheduler_worker.py
│       ├── test_tasks_api.py
│       ├── test_weekly_plan_history.py
│       ├── test_weekly_plan_preview.py
│       └── test_weekly_plan_run_latest.py
├── docs
│   ├── SRS_v2.5.pdf
│   ├── backend_reference.md
│   └── decisions.md
├── mobile
│   ├── App.tsx
│   ├── README.md
│   ├── app.json
│   ├── assets
│   │   ├── .gitkeep
│   │   ├── adaptive-icon.png
│   │   ├── icon.png
│   │   └── splash.png
│   ├── babel.config.js
│   ├── package-lock.json
│   ├── package.json
│   ├── src
│   │   ├── api
│   │   │   ├── .gitkeep
│   │   │   ├── agentLog.ts
│   │   │   ├── brainDump.ts
│   │   │   ├── client.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── interventions.ts
│   │   │   ├── preferences.ts
│   │   │   ├── resolutions.ts
│   │   │   ├── tasks.ts
│   │   │   └── weeklyPlan.ts
│   │   ├── components
│   │   │   ├── .gitkeep
│   │   │   └── HomeFAB.tsx
│   │   ├── hooks
│   │   │   ├── useResolutionPlan.ts
│   │   │   └── useTasks.ts
│   │   ├── screens
│   │   │   ├── .gitkeep
│   │   │   ├── AgentLogDetailScreen.tsx
│   │   │   ├── AgentLogScreen.tsx
│   │   │   ├── BrainDumpScreen.tsx
│   │   │   ├── HomeScreen.tsx
│   │   │   ├── InterventionsHistoryDetailScreen.tsx
│   │   │   ├── InterventionsHistoryScreen.tsx
│   │   │   ├── InterventionsScreen.tsx
│   │   │   ├── MyWeekScreen.tsx
│   │   │   ├── PlanReviewScreen.tsx
│   │   │   ├── ResolutionCreateScreen.tsx
│   │   │   ├── ResolutionDashboardDetailScreen.tsx
│   │   │   ├── ResolutionDashboardScreen.tsx
│   │   │   ├── ResolutionsListScreen.tsx
│   │   │   ├── SettingsPermissionsScreen.tsx
│   │   │   ├── TaskEditScreen.tsx
│   │   │   ├── WeeklyPlanHistoryDetailScreen.tsx
│   │   │   ├── WeeklyPlanHistoryScreen.tsx
│   │   │   ├── WeeklyPlanScreen.tsx
│   │   │   └── components
│   │   │       └── BrainDumpModal.tsx
│   │   ├── state
│   │   │   ├── .gitkeep
│   │   │   └── user.ts
│   │   └── utils
│   │       └── uuid.ts
│   ├── tsconfig.json
│   └── types
│       └── navigation.ts
└── mobile/android
    ├── app
    │   ├── build.gradle
    │   ├── debug.keystore
    │   ├── proguard-rules.pro
    │   └── src
    │       ├── debug
    │       │   └── AndroidManifest.xml
    │       ├── main
    │       │   ├── AndroidManifest.xml
    │       │   ├── java
    │       │   │   └── com
    │       │   │       └── akash114
    │       │   │           └── sarthiai
    │       │   │               ├── MainActivity.kt
    │       │   │               └── MainApplication.kt
    │       │   └── res
    │       │       ├── drawable
    │       │       │   ├── ic_launcher_background.xml
    │       │       │   └── rn_edit_text_material.xml
    │       │       ├── drawable-hdpi
    │       │       │   └── splashscreen_logo.png
    │       │       ├── drawable-mdpi
    │       │       │   └── splashscreen_logo.png
    │       │       ├── drawable-xhdpi
    │       │       │   └── splashscreen_logo.png
    │       │       ├── drawable-xxhdpi
    │       │       │   └── splashscreen_logo.png
    │       │       ├── drawable-xxxhdpi
    │       │       │   └── splashscreen_logo.png
    │       │       ├── mipmap-hdpi
    │       │       │   ├── ic_launcher.webp
    │       │       │   └── ic_launcher_round.webp
    │       │       ├── mipmap-mdpi
    │       │       │   ├── ic_launcher.webp
    │       │       │   └── ic_launcher_round.webp
    │       │       ├── mipmap-xhdpi
    │       │       │   ├── ic_launcher.webp
    │       │       │   └── ic_launcher_round.webp
    │       │       ├── mipmap-xxhdpi
    │       │       │   ├── ic_launcher.webp
    │       │       │   └── ic_launcher_round.webp
    │       │       ├── mipmap-xxxhdpi
    │       │       │   ├── ic_launcher.webp
    │       │       │   └── ic_launcher_round.webp
    │       │       ├── values
    │       │       │   ├── colors.xml
    │       │       │   ├── strings.xml
    │       │       │   └── styles.xml
    │       │       └── xml
    │       │           └── network_security_config.xml
    ├── build.gradle
    ├── gradle
    │   └── wrapper
    │       ├── gradle-wrapper.jar
    │       └── gradle-wrapper.properties
    ├── gradle.properties
    ├── gradlew
    ├── gradlew.bat
    └── settings.gradle
```

> **Note:** The Android sub-tree is shown explicitly because it contains additional Gradle wiring outside `mobile/src`. Use `npm install`/`yarn` to populate `mobile/node_modules` when setting up the mobile app locally.
