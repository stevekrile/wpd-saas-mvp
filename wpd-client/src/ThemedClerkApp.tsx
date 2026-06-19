import { ClerkProvider } from '@clerk/clerk-react';
import { useMemo } from 'react';
import App from './App';
import { useTheme } from './theme/useTheme';

interface ThemedClerkAppProps {
  publishableKey: string;
}

export default function ThemedClerkApp({ publishableKey }: ThemedClerkAppProps) {
  const { resolvedTheme } = useTheme();

  const appearance = useMemo(() => {
    const isDark = resolvedTheme === 'dark';

    return {
      variables: {
        colorPrimary: isDark ? '#8dbdff' : '#012151',
        colorBackground: isDark ? '#0d1a2b' : '#ffffff',
        colorText: isDark ? '#f3f8ff' : '#0f1f35',
        colorTextSecondary: isDark ? '#c7d6e6' : '#2d4465',
        colorInputBackground: isDark ? '#112338' : '#f8fbff',
        colorInputText: isDark ? '#f3f8ff' : '#0f1f35',
        colorNeutral: isDark ? '#1c3149' : '#d6dfeb',
        colorDanger: '#ef4444',
        borderRadius: '0.75rem',
      },
      elements: isDark
        ? {
            cardBox: {
              boxShadow: '0 28px 72px rgba(0, 0, 0, 0.46)',
            },
            card: {
              background: 'linear-gradient(180deg, rgba(10, 23, 40, 0.99), rgba(12, 28, 46, 0.97))',
              border: '1px solid rgba(63, 86, 113, 0.78)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.42)',
            },
            headerTitle: {
              color: '#f3f8ff',
            },
            headerSubtitle: {
              color: '#c7d6e6',
            },
            socialButtonsBlockButton: {
              background: 'rgba(17, 35, 56, 0.96)',
              border: '1px solid rgba(63, 86, 113, 0.78)',
              color: '#f3f8ff',
              boxShadow: 'none',
            },
            socialButtonsBlockButtonText: {
              color: '#f3f8ff',
            },
            socialButtonsBlockButtonArrow: {
              color: '#8dbdff',
            },
            dividerLine: {
              background: 'rgba(63, 86, 113, 0.78)',
            },
            dividerText: {
              color: '#c7d6e6',
            },
            formFieldLabel: {
              color: '#f3f8ff',
            },
            formFieldInput: {
              background: 'rgba(17, 35, 56, 0.98)',
              border: '1px solid rgba(63, 86, 113, 0.78)',
              color: '#f3f8ff',
              boxShadow: 'none',
            },
            formFieldInputShowPasswordButton: {
              color: '#c7d6e6',
            },
            formButtonPrimary: {
              background: 'linear-gradient(135deg, #9fccff 0%, #56c3e9 100%)',
              color: '#081321',
              border: '1px solid rgba(148, 191, 246, 0.42)',
              boxShadow: '0 14px 28px rgba(0, 0, 0, 0.32)',
            },
            footerActionText: {
              color: '#c7d6e6',
            },
            footerActionLink: {
              color: '#8dbdff',
            },
            modalCloseButton: {
              color: '#c7d6e6',
              background: 'transparent',
            },
            identityPreviewText: {
              color: '#f3f8ff',
            },
            identityPreviewEditButton: {
              color: '#8dbdff',
            },
            userButtonPopoverCard: {
              background: 'linear-gradient(180deg, rgba(10, 23, 40, 0.98), rgba(12, 28, 46, 0.96))',
              border: '1px solid rgba(63, 86, 113, 0.78)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.42)',
            },
            userButtonPopoverMain: {
              color: '#f3f8ff',
            },
            userPreviewMainIdentifier: {
              color: '#f3f8ff',
            },
            userPreviewSecondaryIdentifier: {
              color: '#c7d6e6',
            },
            userButtonPopoverActions: {
              background: 'transparent',
            },
            userButtonPopoverActionButton: {
              color: '#f3f8ff',
            },
            userButtonPopoverActionButtonText: {
              color: '#f3f8ff',
            },
            userButtonPopoverActionButtonIcon: {
              color: '#8dbdff',
            },
            userButtonPopoverFooter: {
              background: 'rgba(14, 30, 48, 0.92)',
              borderTop: '1px solid rgba(63, 86, 113, 0.78)',
            },
            userButtonPopoverFooterText: {
              color: '#c7d6e6',
            },
          }
        : {
            card: {
              background: '#ffffff',
              border: '1px solid #d6dfeb',
              boxShadow: '0 20px 44px rgba(1, 33, 81, 0.14)',
            },
            socialButtonsBlockButton: {
              background: '#ffffff',
              border: '1px solid #d6dfeb',
              color: '#0f1f35',
            },
            socialButtonsBlockButtonText: {
              color: '#0f1f35',
            },
            formFieldLabel: {
              color: '#0f1f35',
            },
            formFieldInput: {
              background: '#f8fbff',
              border: '1px solid #d6dfeb',
              color: '#0f1f35',
            },
            footerActionText: {
              color: '#2d4465',
            },
            footerActionLink: {
              color: '#012151',
            },
            userButtonPopoverCard: {
              background: '#ffffff',
              border: '1px solid #d6dfeb',
              boxShadow: '0 20px 44px rgba(1, 33, 81, 0.14)',
            },
            userButtonPopoverActionButtonText: {
              color: '#0f1f35',
            },
            userButtonPopoverActionButtonIcon: {
              color: '#012151',
            },
          },
    };
  }, [resolvedTheme]);

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      afterSignOutUrl="/"
      appearance={appearance}
    >
      <App />
    </ClerkProvider>
  );
}
