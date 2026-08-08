import { PrismaClient } from '@/generated/client';

/**
 * The client handed to the callback of `prisma.$transaction`.
 *
 * Prisma exports no name for this, so every service that wants to accept "the
 * current transaction, or the plain client" ends up typing it `any` and losing
 * the model surface. Declared once here so a method that must participate in a
 * caller's transaction can say so in its signature.
 *
 * A method that takes this and then reaches for the injected `PrismaService`
 * instead has silently opted out of the transaction — which is the most common
 * way an "atomic" operation turns out not to be.
 */
export type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;
