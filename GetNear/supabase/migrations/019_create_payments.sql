-- ============================================================================
-- Migration: 019_create_payments
-- Purpose: Payment transaction log including Razorpay webhook payloads.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    transaction_id VARCHAR(150) NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    webhook_response JSONB,
    failure_reason TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT payments_transaction_id_not_empty CHECK (char_length(trim(transaction_id)) > 0),
    CONSTRAINT payments_amount_positive CHECK (amount > 0),
    CONSTRAINT payments_provider_check CHECK (provider IN ('razorpay', 'cod', 'wallet')),
    CONSTRAINT payments_status_check CHECK (
        status IN ('pending', 'success', 'failed', 'refunded', 'partially_refunded')
    ),

    CONSTRAINT fk_payments_order_id
        FOREIGN KEY (order_id)
        REFERENCES public.orders (id)
        ON DELETE RESTRICT
);

COMMENT ON TABLE public.payments IS
    'Payment audit trail for reconciliation, refunds, and webhook processing.';

COMMENT ON COLUMN public.payments.webhook_response IS
    'Raw Razorpay webhook JSON for debugging and dispute resolution.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments (transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_provider ON public.payments (provider);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON public.payments (paid_at DESC);

DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
