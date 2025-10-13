module.exports = {
  extends: ['react-app', 'react-app/jest'],
  rules: {
    // Disable warnings being treated as errors in production
    'no-unused-vars': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'default-case': 'warn',
    'jsx-a11y/anchor-is-valid': 'warn'
  }
};