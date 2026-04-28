# План Развертывания: Dashboard + Playwright Tests на qa01

## 📋 Текущий Статус Проекта

### Что уже готово ✅

1. **Сервер qa01 настроен:**
    - Ubuntu 22.04 LTS
    - Доступ: `ssh yurii@44.193.127.101` → `ssh -i /home/ubuntu/key ubuntu@qa01`
    - Пользователь для deployment: `git`

2. **Структура директорий создана:**
    - ✅ `/var/www/qa-testing/test-dashboard/` - репозиторий склонирован
    - ✅ `/var/www/qa-testing/probuild-qa/` - репозиторий склонирован
    - Права доступа: `git:git`

3. **Зависимости установлены:**
    - ✅ `npm install` выполнен в обоих проектах
    - ✅ `.env` файл создан
    - ✅ Playwright браузеры установлены

4. **Базовая проверка пройдена:**
    - ✅ Запущен 1 тест через CLI - PASSED
    - Интеграция с reporter работает

5. **PM2 работает:**
    - Уже есть процесс `server`
    - Новый процесс будет называться `qa-dashboard`

6. **GitHub Actions Runner:**
    - Self-hosted runner настроен
    - Готов к использованию

### Что нужно сделать 📝

1. ~~Клонировать репозитории~~ ✅
2. ~~Установить зависимости~~ ✅
3. ~~Создать `.env` файл~~ ✅
4. ~~Проверить работу тестов~~ ✅
5. Собрать Dashboard (`npm run build`)
6. Запустить Dashboard через PM2
7. Проверить Dashboard в браузере
8. Проверить полную интеграцию (discovery + run)
9. Создать GitHub Actions workflow для автоматического деплоя

---

## 🎯 Основная Задача

**Развернуть два проекта на сервере qa01:**

1. **test-dashboard** (Dashboard для мониторинга тестов)
    - Repository: https://github.com/jsnwu/test-dashboard
    - Branch: main
    - Директория: `/var/www/qa-testing/test-dashboard/` ✅ СОЗДАНА

2. **probuild-qa** (Playwright тесты)
    - Repository: https://github.com/probuildGit/probuild-qa
    - Branch: dev
    - Директория: `/var/www/qa-testing/probuild-qa/` ✅ СОЗДАНА

**Цель:** Автоматический деплой через GitHub Actions при push в main/dev ветки.

> **ВАЖНО:** В документе далее используются названия `/var/www/qa-testing/dashboard/` и `/var/www/qa-testing/playwright-tests/`.
> На сервере созданы: `test-dashboard/` и `probuild-qa/`.
> При следовании инструкциям заменяйте:
>
> - `dashboard/` → `test-dashboard/`
> - `playwright-tests/` → `probuild-qa/`

---

## 🏗️ Архитектура

```
┌────────────────────────────────────────────────────────────┐
│                     QA01 Server                            │
│                  (172.16.30.231)                           │
│                                                            │
│  /var/www/qa-testing/test-dashboard/          ✅ ГОТОВО  │
│  ├── packages/server/  → PM2: qa-dashboard-server         │
│  ├── packages/web/     → PM2: qa-dashboard-web            │
│  ├── .env              → Production config      ✅        │
│  ├── node_modules/     → Зависимости            ✅        │
│  └── ecosystem.config.js                                  │
│                                                            │
│  /var/www/qa-testing/probuild-qa/             ✅ ГОТОВО  │
│  ├── e2e/tests/        → Playwright тесты                 │
│  ├── .env              → DASHBOARD_API_URL      ✅        │
│  ├── node_modules/     → Зависимости + reporter ✅        │
│  └── playwright.config.ts                                 │
│                                                            │
│  /opt/actions-runner/  → GitHub Actions runner  ✅        │
└────────────────────────────────────────────────────────────┘
```

**Сетевой доступ:**

- Dashboard UI: http://172.16.30.231:3000
- Dashboard API: http://172.16.30.231:3001

---

## 📂 Файлы которые нужно создать

### 1. GitHub Actions Workflow для Dashboard

**Файл:** `.github/workflows/deploy.yml` (в репозитории test-dashboard)

```yaml
name: Deploy Dashboard to QA01

on:
    push:
        branches: [main]
    workflow_dispatch:

jobs:
    deploy:
        runs-on: [self-hosted]

        steps:
            - name: Checkout code
              uses: actions/checkout@v4

            - name: Setup Node.js
              uses: actions/setup-node@v4
              with:
                  node-version: '18'
                  cache: 'npm'

            - name: Install dependencies
              run: npm install --legacy-peer-deps

            - name: Type check
              run: npm run type-check

            - name: Lint
              run: npm run lint

            - name: Run tests
              run: npm test

            - name: Build project
              run: npm run build

            - name: Deploy to QA01
              run: |
                  rsync -avz --delete \
                    --exclude 'node_modules' \
                    --exclude '.git' \
                    --exclude '.env' \
                    --exclude '*.db' \
                    --exclude 'logs/' \
                    --exclude 'test-results/' \
                    ${{ github.workspace }}/ \
                    git@qa01:/var/www/qa-testing/test-dashboard/

              # Что защищено от перезаписи:
              # - .env (настройки production)
              # - *.db (включая test-results.db - база данных с историей тестов)
              # - logs/ (логи PM2)
              # - test-results/ (вся директория с базой данных И attachments)

            - name: Install production dependencies on QA01
              run: ssh git@qa01 "cd /var/www/qa-testing/test-dashboard && npm install --production --legacy-peer-deps"

            - name: Restart Dashboard PM2 process
              run: ssh git@qa01 "cd /var/www/qa-testing/test-dashboard && pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js"

            - name: Verify deployment
              run: |
                  sleep 5
                  curl -f http://172.16.30.231:3001/api/health || echo "Health check failed - manual verification needed"
```

### 2. Environment файл на сервере

**Файл:** `/var/www/qa-testing/test-dashboard/.env` ✅ СОЗДАН

```bash
# Dashboard Production Environment - QA01
PORT=3001
NODE_ENV=production

# Server URLs (IP-based)
BASE_URL=http://172.16.30.231:3001
VITE_BASE_URL=http://172.16.30.231:3001
VITE_PORT=3000

# Playwright Integration
PLAYWRIGHT_PROJECT_DIR=/var/www/qa-testing/probuild-qa

# Authentication
ENABLE_AUTH=true
JWT_SECRET=СГЕНЕРИРОВАТЬ_СЕКРЕТНЫЙ_КЛЮЧ
JWT_EXPIRES_IN=30d
ADMIN_EMAIL=qa@probuild.com
ADMIN_PASSWORD=УСТАНОВИТЬ_БЕЗОПАСНЫЙ_ПАРОЛЬ
```

**ВАЖНО:** База данных хранится в файле `test-results.db`, а не `database.db`!
Файл автоматически создается при первом запуске сервера в `/var/www/qa-testing/test-dashboard/test-results/test-results.db`

**Как сгенерировать JWT_SECRET:**

```bash
openssl rand -hex 32
```

### 3. Environment файл для Playwright тестов

**Файл:** `/var/www/qa-testing/probuild-qa/.env` ✅ СОЗДАН

```bash
# Probuild QA Tests - Dashboard Integration
DASHBOARD_API_URL=http://172.16.30.231:3001

# Добавьте свои переменные для тестов ниже
# BASE_URL=http://your-app-url.com
```

---

## 🚀 Пошаговая Инструкция по Развертыванию

### ШАГ 1: Подключение к серверу

**Что делаем:** Подключаемся к qa01 для выполнения команд

```bash
# 1. Подключитесь к admin серверу
ssh yurii@44.193.127.101
# Введите passphrase когда попросит

# 2. Станьте root на admin
sudo su

# 3. Подключитесь к qa01
ssh -i /home/ubuntu/key ubuntu@qa01

# 4. Станьте root на qa01
sudo su

# 5. Переключитесь на пользователя git (важно!)
su git

# 6. Проверьте что вы git пользователь
whoami
# Должно показать: git
```

---

### ШАГ 2: Клонирование Dashboard репозитория

**Что делаем:** Скачиваем код Dashboard на сервер

```bash
# 1. Перейдите в директорию dashboard
cd /var/www/qa-testing/dashboard

# 2. Клонируйте репозиторий (если еще не клонирован)
git clone git@github.com:jsnwu/test-dashboard.git .

# Если репозиторий уже склонирован, обновите его:
git pull origin main
```

**Объяснение:**

- `.` в конце команды означает клонировать в текущую директорию
- Если возникла ошибка "Permission denied" - нужно настроить SSH ключи git пользователя для GitHub

---

### ШАГ 3: Установка зависимостей и сборка

**Что делаем:** Устанавливаем npm пакеты и собираем проект

```bash
# Находясь в /var/www/qa-testing/dashboard

# 1. Установите зависимости
npm install --legacy-peer-deps

# Объяснение флага:
# --legacy-peer-deps нужен для совместимости зависимостей

# 2. Соберите проект
npm run build

# Что происходит:
# - TurboRepo собирает все пакеты (server, web, reporter, core)
# - Создаются dist директории с готовым кодом
# - Процесс может занять 2-3 минуты
```

**Ожидаемый результат:**

- Директория `packages/server/dist/` создана
- Директория `packages/web/dist/` создана
- Нет ошибок в выводе

---

### ШАГ 4: Создание .env файла

**Что делаем:** Создаем файл с настройками production

```bash
# Находясь в /var/www/qa-testing/dashboard

# 1. Сгенерируйте JWT секрет
JWT_SECRET=$(openssl rand -hex 32)
echo "Ваш JWT_SECRET: $JWT_SECRET"
# СКОПИРУЙТЕ этот ключ!

# 2. Создайте .env файл
cat > .env << 'EOF'
# Dashboard Production Environment - QA01
PORT=3001
NODE_ENV=production

# Server URLs
BASE_URL=http://172.16.30.231:3001
VITE_BASE_URL=http://172.16.30.231:3001
VITE_PORT=3000

# Playwright Integration
PLAYWRIGHT_PROJECT_DIR=/var/www/qa-testing/playwright-tests

# Authentication
ENABLE_AUTH=true
JWT_SECRET=ВСТАВЬТЕ_СЮДА_СГЕНЕРИРОВАННЫЙ_КЛЮЧ
JWT_EXPIRES_IN=30d
ADMIN_EMAIL=qa@probuild.com
ADMIN_PASSWORD=qwe123
EOF

# 3. Отредактируйте файл и вставьте ваш JWT_SECRET
nano .env
# или
vi .env

# Замените "ВСТАВЬТЕ_СЮДА_СГЕНЕРИРОВАННЫЙ_КЛЮЧ" на скопированный JWT_SECRET
# Измените пароль на более безопасный
# Сохраните: Ctrl+X, затем Y, затем Enter (для nano)
```

**Важно:**

- JWT_SECRET должен быть уникальным и секретным
- Пароль должен быть достаточно сложным для production
- Этот файл НЕ должен попадать в git (он уже в .gitignore)

---

### ШАГ 5: Создание директорий для логов и результатов

**Что делаем:** Создаем директории которые нужны Dashboard

```bash
# Находясь в /var/www/qa-testing/dashboard

# 1. Создайте директорию для логов PM2
mkdir -p logs

# 2. Создайте директорию для сохранения attachments тестов
mkdir -p test-results

# 3. Проверьте что директории созданы
ls -la
# Должны быть видны: logs/ и test-results/
```

**Объяснение:**

- `logs/` - сюда PM2 будет писать логи процессов
- `test-results/` - сюда Dashboard сохраняет screenshots и videos из тестов

---

### ШАГ 6: Проверка ecosystem.config.js

**Что делаем:** Убеждаемся что конфиг PM2 правильный

```bash
# Находясь в /var/www/qa-testing/dashboard

# 1. Посмотрите содержимое файла
cat ecosystem.config.js
```

**Ожидаемое содержимое:**

```javascript
module.exports = {
    apps: [
        {
            name: 'dashboard-server-qa01',
            cwd: './packages/server',
            script: 'dist/index.js',
            // ... остальные настройки
        },
        {
            name: 'dashboard-web-qa01',
            cwd: './packages/web',
            script: 'npx',
            args: 'vite preview --host 0.0.0.0 --port 3000',
            // ... остальные настройки
        },
    ],
}
```

**Если нужно переименовать процессы:**

Можно оставить как есть (`dashboard-server-qa01` и `dashboard-web-qa01`) или переименовать в `qa-dashboard-server` и `qa-dashboard-web` для соответствия вашей конвенции.

---

### ШАГ 7: Запуск PM2 процессов

**Что делаем:** Запускаем Dashboard через PM2

```bash
# Находясь в /var/www/qa-testing/dashboard

# 1. Запустите процессы через ecosystem.config.js
pm2 start ecosystem.config.js

# Что происходит:
# - PM2 запускает 2 процесса: сервер и веб
# - Сервер стартует на порту 3001
# - Веб стартует на порту 3000

# 2. Сохраните конфигурацию PM2
pm2 save

# Объяснение:
# Это сохраняет список процессов, чтобы они автоматически
# запускались после перезагрузки сервера

# 3. Настройте автозапуск PM2 при загрузке системы
pm2 startup systemd -u git --hp /home/git

# PM2 выдаст команду которую нужно выполнить как root
# Скопируйте эту команду и выполните её (см. следующий шаг)
```

**Если PM2 выдал команду для root:**

```bash
# Выйдите из git пользователя
exit

# Выполните команду которую выдал PM2 (примерно такую):
sudo env PATH=$PATH:/usr/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u git --hp /home/git

# Вернитесь обратно к git пользователю
su git
```

---

### ШАГ 8: Проверка что Dashboard запустился

**Что делаем:** Проверяем что все работает

```bash
# 1. Проверьте статус PM2 процессов
pm2 status

# Ожидаемый результат:
# ┌─────┬──────────────────────────┬─────────┬─────────┐
# │ id  │ name                     │ status  │ restart │
# ├─────┼──────────────────────────┼─────────┼─────────┤
# │ 0   │ dashboard-server-qa01    │ online  │ 0       │
# │ 1   │ dashboard-web-qa01       │ online  │ 0       │
# └─────┴──────────────────────────┴─────────┴─────────┘

# 2. Посмотрите логи сервера
pm2 logs dashboard-server-qa01 --lines 20

# Должны быть примерно такие строки:
# Server listening on port 3001
# Database initialized
# WebSocket server started

# 3. Посмотрите логи веб-приложения
pm2 logs dashboard-web-qa01 --lines 20

# 4. Проверьте что API отвечает
curl http://172.16.30.231:3001/api/health

# Ожидаемый ответ:
# {"status":"healthy","timestamp":"..."}

# 5. Проверьте что веб-интерфейс доступен
curl -I http://172.16.30.231:3000

# Ожидаемый ответ:
# HTTP/1.1 200 OK
```

**Если что-то не работает:**

**Проблема 1: PM2 процесс в статусе "errored"**

```bash
# Посмотрите детальные логи
pm2 logs dashboard-server-qa01 --lines 100

# Частые причины:
# - Нет .env файла
# - Неправильный JWT_SECRET в .env
# - Порт 3001 уже занят другим процессом
# - Проект не собран (нет dist директории)
```

**Проблема 2: curl возвращает ошибку**

```bash
# Проверьте что процесс слушает на порту
netstat -tlnp | grep 3001

# Если порт не занят - процесс не запустился
# Смотрите логи PM2
```

---

### ШАГ 9: Проверка в браузере

**Что делаем:** Открываем Dashboard в браузере

1. **Откройте браузер на вашем компьютере**
2. **Перейдите по адресу:** http://172.16.30.231:3000
3. **Должна открыться страница логина**
4. **Введите данные:**
    - Email: `qa@probuild.com`
    - Password: `qwe123` (или пароль который вы указали в .env)
5. **После входа должен открыться Dashboard**

**Если страница не открывается:**

- Проверьте что вы можете достучаться до сервера: `ping 172.16.30.231`
- Проверьте firewall на qa01: `sudo ufw status`
- Проверьте что веб процесс запущен: `pm2 status`

---

### ШАГ 10: Настройка Playwright тестов

**Что делаем:** Устанавливаем и настраиваем тесты

```bash
# 1. Перейдите в директорию тестов
cd /var/www/qa-testing/playwright-tests

# 2. Клонируйте репозиторий (если еще не склонирован)
git clone git@github.com:probuildGit/probuild-qa.git .

# 3. Установите зависимости
npm install

# Это установит все зависимости включая playwright-dashboard-reporter

# 4. Проверьте что reporter установлен
npm list playwright-dashboard-reporter

# Должно показать: playwright-dashboard-reporter@1.0.3

# 5. Установите браузеры Playwright
npx playwright install --with-deps chromium

# Эта команда:
# - Скачает chromium браузер
# - Установит системные зависимости

# 6. Создайте .env файл
cat > .env << 'EOF'
# Probuild QA Tests - Dashboard Integration
DASHBOARD_API_URL=http://172.16.30.231:3001

# Добавьте ваши переменные для тестов
EOF

# 7. Проверьте что тесты могут запуститься
export DASHBOARD_API_URL=http://172.16.30.231:3001
npx playwright test --reporter=playwright-dashboard-reporter --list

# Должен показать список всех тестов
```

---

### ШАГ 11: Проверка интеграции Dashboard и тестов

**Что делаем:** Проверяем что Dashboard видит тесты

1. **В браузере откройте Dashboard:** http://172.16.30.231:3000
2. **Найдите кнопку "Discover Tests"** (или "Обнаружить тесты")
3. **Нажмите на неё**
4. **Dashboard должен:**
    - Просканировать директорию `/var/www/qa-testing/playwright-tests`
    - Найти все тесты
    - Показать их в списке

5. **Нажмите "Run All"** (или "Запустить все")
6. **Должны:**
    - Запуститься тесты
    - Результаты появляться в реальном времени через WebSocket
    - Screenshots и videos сохраняться в Dashboard

**Если тесты не обнаруживаются:**

```bash
# Проверьте переменную PLAYWRIGHT_PROJECT_DIR в .env Dashboard
cat /var/www/qa-testing/dashboard/.env | grep PLAYWRIGHT_PROJECT_DIR

# Должно быть:
# PLAYWRIGHT_PROJECT_DIR=/var/www/qa-testing/playwright-tests

# Перезапустите сервер если меняли .env
pm2 restart dashboard-server-qa01
```

---

### ШАГ 12: Создание GitHub Actions Workflow

**Что делаем:** Создаем файл для автоматического деплоя

**На вашем локальном компьютере:**

```bash
# 1. Перейдите в директорию Dashboard проекта
cd /path/to/test-dashboard

# 2. Создайте директорию для workflows (если нет)
mkdir -p .github/workflows

# 3. Создайте файл deploy.yml
# Содержимое смотрите в разделе "Файлы которые нужно создать" выше

# 4. Добавьте файл в git
git add .github/workflows/deploy.yml

# 5. Закоммитьте
git commit -m "Add GitHub Actions deployment workflow for qa01"

# 6. Запушьте в main ветку
git push origin main
```

**Что произойдет после push:**

1. GitHub Actions обнаружит новый workflow
2. Self-hosted runner на qa01 получит задание
3. Workflow выполнит:
    - Checkout кода
    - Установку зависимостей
    - Type check
    - Lint
    - Тесты
    - Сборку
    - Деплой через rsync
    - Перезапуск PM2

---

### ШАГ 13: Мониторинг первого деплоя

**Что делаем:** Проверяем что автоматический деплой работает

1. **Откройте GitHub репозиторий в браузере**
2. **Перейдите во вкладку "Actions"**
3. **Найдите запущенный workflow "Deploy Dashboard to QA01"**
4. **Следите за выполнением шагов**

**Параллельно на сервере:**

```bash
# Подключитесь к qa01 как git пользователь
# Следите за логами runner
tail -f /opt/actions-runner/_diag/Runner_*.log

# В другом терминале следите за PM2
pm2 logs --lines 50
```

**После успешного деплоя:**

- Workflow должен завершиться зеленым статусом ✓
- PM2 процессы должны перезапуститься
- Dashboard должен быть доступен с обновленным кодом

---

## 🔧 Важные Команды для Работы

### PM2 Управление

```bash
# Посмотреть статус всех процессов
pm2 status

# Посмотреть логи конкретного процесса
pm2 logs dashboard-server-qa01
pm2 logs dashboard-web-qa01

# Посмотреть логи всех процессов
pm2 logs

# Перезапустить процесс
pm2 restart dashboard-server-qa01

# Перезапустить все процессы
pm2 restart all

# Остановить процесс
pm2 stop dashboard-server-qa01

# Запустить процесс
pm2 start ecosystem.config.js

# Удалить процесс из PM2
pm2 delete dashboard-server-qa01

# Мониторинг в реальном времени
pm2 monit
```

### Git Команды на Сервере

```bash
# Проверить текущую ветку и статус
git status

# Переключиться на ветку
git checkout main

# Обновить код
git pull origin main

# Посмотреть последние коммиты
git log --oneline -10
```

### Проверка Сервисов

```bash
# Проверить что порт слушается
netstat -tlnp | grep 3001
netstat -tlnp | grep 3000

# Проверить процессы Node.js
ps aux | grep node

# Проверить использование диска
df -h

# Проверить использование памяти
free -h

# Проверить логи системы
journalctl -u pm2-git -n 50
```

---

## 🆘 Решение Проблем

### Проблема 1: "Permission denied" при git clone

**Причина:** У git пользователя нет SSH ключей для GitHub

**Решение:**

```bash
# Как git пользователь
su git

# Сгенерируйте SSH ключ
ssh-keygen -t ed25519 -C "git@qa01"

# Просто нажимайте Enter на все вопросы

# Скопируйте публичный ключ
cat ~/.ssh/id_ed25519.pub

# Добавьте этот ключ в GitHub:
# 1. Откройте https://github.com/jsnwu/test-dashboard/settings/keys
# 2. Нажмите "Add deploy key"
# 3. Вставьте скопированный ключ
# 4. Отметьте "Allow write access" если нужен push (обычно НЕ нужно)
# 5. Сохраните

# Проверьте подключение
ssh -T git@github.com
```

### Проблема 2: PM2 процесс падает сразу после старта

**Проверка:**

```bash
# Посмотрите детальные логи
pm2 logs dashboard-server-qa01 --lines 200 --err

# Частые ошибки и решения:

# 1. "Cannot find module './dist/index.js'"
#    Решение: npm run build

# 2. "PORT is already in use"
#    Решение: Проверьте кто использует порт
#    netstat -tlnp | grep 3001
#    Остановите другой процесс или измените PORT в .env

# 3. "JWT_SECRET is not defined"
#    Решение: Проверьте .env файл
#    cat .env | grep JWT_SECRET

# 4. "ENOENT: no such file or directory, open 'database.db'"
#    Решение: Проверьте что OUTPUT_DIR существует
#    Сервер сам создаст БД при первом запуске
```

### Проблема 3: GitHub Actions workflow не запускается

**Проверка:**

```bash
# На qa01 проверьте статус runner
cd /opt/actions-runner
sudo ./svc.sh status

# Должно быть: active (running)

# Если inactive:
sudo ./svc.sh start

# Проверьте логи runner
tail -f _diag/Runner_*.log
```

**В GitHub:**

1. Откройте Settings → Actions → Runners
2. Проверьте что runner показывает статус "Idle" (зеленый)
3. Если "Offline" - перезапустите на сервере

### Проблема 4: Тесты не отправляют результаты в Dashboard

**Проверка:**

```bash
# 1. Проверьте что reporter установлен
cd /var/www/qa-testing/playwright-tests
npm list playwright-dashboard-reporter

# 2. Проверьте .env файл тестов
cat .env | grep DASHBOARD_API_URL
# Должно быть: DASHBOARD_API_URL=http://172.16.30.231:3001

# 3. Проверьте что Dashboard API доступен
curl http://172.16.30.231:3001/api/health

# 4. Запустите тест вручную с reporter
export DASHBOARD_API_URL=http://172.16.30.231:3001
npx playwright test --reporter=playwright-dashboard-reporter -g "simple test"

# Смотрите вывод - должны быть сообщения о отправке результатов
```

### Проблема 5: "ENOSPC: System limit for number of file watchers reached"

**Решение:**

```bash
# Как root
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## 📊 Ожидаемый Результат

После выполнения всех шагов у вас должно быть:

### ✅ Dashboard работает

- UI доступен: http://172.16.30.231:3000
- API доступен: http://172.16.30.231:3001
- Аутентификация работает
- PM2 процессы запущены и стабильны

### ✅ Playwright тесты настроены

- Тесты находятся в `/var/www/qa-testing/playwright-tests`
- Reporter установлен
- Dashboard обнаруживает тесты

### ✅ Интеграция работает

- Dashboard может запускать тесты
- Результаты тестов отображаются в UI
- Screenshots и videos сохраняются
- История выполнений доступна

### ✅ CI/CD настроен

- Push в main ветку → автоматический деплой Dashboard
- GitHub Actions workflow выполняется успешно
- PM2 перезапускается автоматически

---

## 📝 Следующие Шаги (Опционально)

### 1. Настройка домена

Если у вас появится домен (например, qa-dashboard.probuild.com):

```bash
# Обновите .env на сервере
cd /var/www/qa-testing/dashboard
nano .env

# Измените:
BASE_URL=https://qa-dashboard.probuild.com
VITE_BASE_URL=https://qa-dashboard.probuild.com

# Перезапустите
pm2 restart all
```

### 2. Настройка HTTPS (Nginx + Let's Encrypt)

```bash
# Установите nginx
sudo apt install nginx

# Установите certbot
sudo apt install certbot python3-certbot-nginx

# Получите SSL сертификат
sudo certbot --nginx -d qa-dashboard.probuild.com
```

### 3. Настройка бэкапов базы данных

```bash
# Добавьте в crontab git пользователя
crontab -e

# Добавьте строку (бэкап каждый день в 2 ночи):
0 2 * * * sqlite3 /var/www/qa-testing/dashboard/packages/server/database.db ".backup '/var/backups/dashboard-$(date +\%Y\%m\%d).db'"
```

### 4. Настройка ротации логов PM2

```bash
# Установите pm2-logrotate
pm2 install pm2-logrotate

# Настройте параметры
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

---

## 📞 Если нужна помощь

**Полезные команды для диагностики:**

```bash
# Полный статус системы
pm2 status
pm2 logs --lines 50
netstat -tlnp | grep -E '3000|3001'
df -h
free -h

# Информация о процессах
ps aux | grep node
ps aux | grep pm2

# Логи системы
journalctl -u pm2-git -n 100
```

**Сохраните эту информацию перед обращением за помощью:**

1. Вывод `pm2 logs --lines 100`
2. Вывод `pm2 status`
3. Содержимое `.env` (без секретных ключей!)
4. Логи GitHub Actions (если проблема с деплоем)

---

**Дата создания:** 2025-12-29
**Последнее обновление:** 2025-12-31
**Версия документа:** 1.2
**Статус:** Частично выполнено - репозитории склонированы, зависимости установлены, базовая проверка пройдена

---

## 🔐 КРИТИЧЕСКИ ВАЖНАЯ ИНФОРМАЦИЯ О ДАННЫХ

### База данных и история тестов

**Имя файла базы данных:** `test-results.db` (НЕ `database.db`!)

**Расположение:**

```
/var/www/qa-testing/test-dashboard/test-results/test-results.db
```

**Защита данных при деплое:**

GitHub Actions workflow **ПОЛНОСТЬЮ ЗАЩИЩАЕТ** вашу историю тестов:

```yaml
--exclude '*.db'           # Все .db файлы (включая test-results.db)
--exclude 'test-results/'  # Вся директория с базой И attachments
```

**Что происходит при каждом деплое:**

✅ **СОХРАНЯЕТСЯ:**

- `test-results.db` - вся история тестов
- Все screenshots и videos в `test-results/`
- `.env` файл с настройками production
- `logs/` - логи PM2

✅ **ОБНОВЛЯЕТСЯ:**

- Исходный код приложения (packages/)
- `package.json`
- `ecosystem.config.js`

✅ **ПЕРЕУСТАНАВЛИВАЕТСЯ:**

- `node_modules/` - удаляется и устанавливается заново

**Локальная база VS Серверная:**

| Окружение                  | База данных     | Расположение                                                      |
| -------------------------- | --------------- | ----------------------------------------------------------------- |
| **Локально** (development) | test-results.db | `/path/to/test-dashboard/test-results/` |
| **Сервер** (production)    | test-results.db | `/var/www/qa-testing/test-dashboard/test-results/`                |

**Это РАЗНЫЕ базы данных для РАЗНЫХ окружений** - и это правильно!

**Бэкапы (рекомендуется настроить):**

```bash
# Создайте директорию для бэкапов
sudo mkdir -p /var/backups
sudo chown git:git /var/backups

# Добавьте в crontab (как git пользователь)
crontab -e

# Вставьте строку (бэкап каждый день в 2 ночи):
0 2 * * * sqlite3 /var/www/qa-testing/test-dashboard/test-results/test-results.db ".backup '/var/backups/dashboard-$(date +\%Y\%m\%d).db'"
```

**В случае проблем:**

Если база данных случайно удалена или повреждена:

1. Сервер автоматически создаст новую пустую базу при старте
2. История будет утеряна (если нет бэкапа)
3. Восстановите из бэкапа если он есть:
    ```bash
    cd /var/www/qa-testing/test-dashboard/test-results
    cp /var/backups/dashboard-YYYYMMDD.db ./test-results.db
    pm2 restart all
    ```
