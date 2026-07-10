-- ============================================================================
-- Migration: 021_create_notifications
-- Purpose: In-app notifications for order updates and promotional messages.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL DEFAULT 'general',
    reference_type VARCHAR(50),
    reference_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT notifications_title_not_empty CHECK (char_length(trim(title)) > 0),
    CONSTRAINT notifications_message_not_empty CHECK (char_length(trim(message)) > 0),
    CONSTRAINT notifications_type_check CHECK (
        notification_type IN ('general', 'order', 'payment', 'promotion', 'system')
    ),

    CONSTRAINT fk_notifications_user_id
        FOREIGN KEY (user_id)
        REFERENCES public.users (id)
        ON DELETE CASCADE
);

COMMENT ON TABLE public.notifications IS
    'User notification inbox for order status, payments, and marketing alerts.';

COMMENT ON COLUMN public.notifications.reference_type IS
    'Polymorphic reference entity name (e.g. orders, offers).';

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications (notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
