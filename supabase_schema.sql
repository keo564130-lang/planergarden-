-- =========================================================================
-- ПОЛНАЯ СХЕМА БАЗЫ ДАННЫХ ДЛЯ ДАЧНОГО ПЛАНЕРА (Supabase SQL Migration)
-- Версия: 2.5.05+
-- Данный скрипт безопасен: он не удаляет существующие данные,
-- а создаёт отсутствующие таблицы и добавляет недостающие колонки.
-- =========================================================================

-- Включаем расширение для генерации UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. ТАБЛИЦА ЗАДАЧ (tasks)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title TEXT NOT NULL,
    category TEXT DEFAULT 'garden',
    time TEXT,
    completed BOOLEAN DEFAULT false,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Безопасное добавление колонок, если таблица уже существовала
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'garden';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Индексы
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON public.tasks(user_id, date);

-- RLS (Безопасность строк)
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own tasks" ON public.tasks;
CREATE POLICY "Users can manage their own tasks" ON public.tasks
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 2. ТАБЛИЦА ТАБЛИЦ ДНЯ (day_tables)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.day_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    date DATE NOT NULL,
    name TEXT NOT NULL,
    time TEXT,
    template_id TEXT,
    headers JSONB DEFAULT '[]'::jsonb,
    rows JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.day_tables ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.day_tables ADD COLUMN IF NOT EXISTS date DATE;
ALTER TABLE public.day_tables ADD COLUMN IF NOT EXISTS time TEXT;
ALTER TABLE public.day_tables ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE public.day_tables ADD COLUMN IF NOT EXISTS headers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.day_tables ADD COLUMN IF NOT EXISTS rows JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.day_tables ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_day_tables_user_date ON public.day_tables(user_id, date);

ALTER TABLE public.day_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own day tables" ON public.day_tables;
CREATE POLICY "Users can manage their own day tables" ON public.day_tables
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 3. ТАБЛИЦА КАТЕГОРИЙ РЕЦЕПТОВ (recipe_categories)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.recipe_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '📁',
    color TEXT DEFAULT 'default',
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS emoji TEXT DEFAULT '📁';
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'default';
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE public.recipe_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_recipe_categories_user_pos ON public.recipe_categories(user_id, position);

ALTER TABLE public.recipe_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own recipe categories" ON public.recipe_categories;
CREATE POLICY "Users can manage their own recipe categories" ON public.recipe_categories
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 4. ТАБЛИЦА РЕЦЕПТОВ (recipes)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    category_id UUID REFERENCES public.recipe_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    content TEXT DEFAULT '',
    photos JSONB DEFAULT '[]'::jsonb,
    video_url TEXT,
    color TEXT DEFAULT 'default',
    tags JSONB DEFAULT '[]'::jsonb,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.recipe_categories(id) ON DELETE SET NULL;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS photos JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'default';
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_recipes_user_cat ON public.recipes(user_id, category_id);

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own recipes" ON public.recipes;
CREATE POLICY "Users can manage their own recipes" ON public.recipes
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 5. ТАБЛИЦА ЗАМЕТОК К РЕЦЕПТАМ (recipe_notes)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.recipe_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.recipe_notes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.recipe_notes ADD COLUMN IF NOT EXISTS recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE;
ALTER TABLE public.recipe_notes ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE public.recipe_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_recipe_notes_recipe ON public.recipe_notes(recipe_id);

ALTER TABLE public.recipe_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own recipe notes" ON public.recipe_notes;
CREATE POLICY "Users can manage their own recipe notes" ON public.recipe_notes
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =========================================================================
-- 6. ТАБЛИЦЫ ИИ ПОМОЩНИКА (ai_chats & ai_messages)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.ai_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title TEXT DEFAULT 'Новый чат',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_chats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.ai_chats ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Новый чат';
ALTER TABLE public.ai_chats ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ai_chats_user ON public.ai_chats(user_id);

ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own ai chats" ON public.ai_chats;
CREATE POLICY "Users can manage their own ai chats" ON public.ai_chats
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES public.ai_chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES public.ai_chats(id) ON DELETE CASCADE;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_ai_messages_chat ON public.ai_messages(chat_id, created_at);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own ai messages" ON public.ai_messages;
CREATE POLICY "Users can manage their own ai messages" ON public.ai_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.ai_chats
            WHERE public.ai_chats.id = public.ai_messages.chat_id
            AND public.ai_chats.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.ai_chats
            WHERE public.ai_chats.id = public.ai_messages.chat_id
            AND public.ai_chats.user_id = auth.uid()
        )
    );

-- =========================================================================
-- 7. ТАБЛИЦА PUSH УВЕДОМЛЕНИЙ (push_subscriptions)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    subscription JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS subscription JSONB;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage their own push subscriptions" ON public.push_subscriptions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
