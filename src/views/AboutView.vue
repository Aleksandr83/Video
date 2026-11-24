<template>
    <section class="about-view">
        <h2 class="about-view__title">{{ t('aboutTitle') }}</h2>

        <p v-if="loading" class="about-view__loading">{{ t('aboutLoading') }}</p>
        <p v-else-if="failed" class="about-view__error">{{ t('aboutLoadError') }}</p>

        <template v-else>
            <dl class="about-view__facts">
                <dt>{{ t('aboutAppVersion') }}</dt>
                <dd class="about-view__app-version">{{ summary.appVersion || unknown }}</dd>
                <dt>{{ t('aboutNextcloudVersion') }}</dt>
                <dd class="about-view__nextcloud-version">{{ summary.nextcloudVersion || unknown }}</dd>
            </dl>

            <h3 class="about-view__migrations-title">{{ t('aboutMigrationsTitle') }}</h3>
            <ul v-if="summary.migrations.length" class="about-view__migrations">
                <li v-for="migration in summary.migrations"
                    :key="migration.version"
                    class="about-view__migration"
                    :data-applied="String(migration.applied)">
                    <span class="about-view__migration-version">{{ migration.version }}</span>
                    <span class="about-view__migration-status">
                        {{ migration.applied ? t('aboutMigrationApplied') : t('aboutMigrationNotApplied') }}
                    </span>
                </li>
            </ul>

            <ul v-if="summary.warnings.length" class="about-view__warnings">
                <li v-for="warning in summary.warnings" :key="warning" class="about-view__warning">
                    {{ warningLabel(warning) }}
                </li>
            </ul>
        </template>
    </section>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { t } from '../i18n'
import { getAbout } from '../api/about'

const loading = ref(true)
const failed = ref(false)
const unknown = '—'
const summary = reactive({ appVersion: '', nextcloudVersion: '', migrations: [], warnings: [] })

// The screen names what is wrong in the user's words, but keeps the reason as a code the endpoint defines.
const WARNINGS = {
    migration_not_applied: 'aboutWarningMigrationNotApplied',
    version_below_migrations: 'aboutWarningVersionBelowMigrations',
}

function warningLabel(warning) {
    const key = WARNINGS[warning]

    return key ? t(key) : warning
}

onMounted(async () => {
    try {
        const { data } = await getAbout()
        summary.appVersion = data.appVersion ?? ''
        summary.nextcloudVersion = data.nextcloudVersion ?? ''
        summary.migrations = data.migrations ?? []
        summary.warnings = data.warnings ?? []
    } catch (error) {
        failed.value = true
    } finally {
        loading.value = false
    }
})
</script>

<style scoped>
.about-view {
    max-width: 720px;
}

.about-view__title {
    margin: 0 0 12px;
    font-size: 20px;
}

.about-view__loading,
.about-view__error {
    color: var(--color-text-maxcontrast);
}

.about-view__error {
    color: var(--color-error);
}

.about-view__facts {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 4px 12px;
    margin: 0 0 20px;
}

.about-view__facts dt {
    color: var(--color-text-maxcontrast);
}

.about-view__facts dd {
    margin: 0;
    font-weight: 600;
    text-align: right;
}

.about-view__migrations-title {
    margin: 0 0 8px;
    font-size: 16px;
}

.about-view__migrations {
    list-style: none;
    margin: 0 0 20px;
    padding: 0;
}

.about-view__migration {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--color-border);
}

.about-view__migration-version {
    font-family: var(--font-monospace, monospace);
}

.about-view__migration-status {
    color: var(--color-text-maxcontrast);
}

.about-view__migration[data-applied='false'] .about-view__migration-status {
    color: var(--color-error);
    font-weight: 600;
}

.about-view__warnings {
    list-style: none;
    margin: 0;
    padding: 0;
}

.about-view__warning {
    padding: 8px 12px;
    margin-bottom: 8px;
    border-radius: 8px;
    background: var(--color-background-error);
    color: var(--color-error-text);
}
</style>
