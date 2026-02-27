import type { Meta, StoryObj } from '@storybook/react-vite';
import { LoginPage } from '../../components/LoginPage';

const meta: Meta<typeof LoginPage> = {
  title: 'Screens/LoginPage',
  component: LoginPage,
  parameters: { layout: 'fullscreen' },
  args: {
    onLogin: () => console.log('Login'),
    onSignUp: () => console.log('Sign up'),
  },
};

export default meta;
type Story = StoryObj<typeof LoginPage>;

export const Default: Story = {
  name: 'Sign in view',
};
