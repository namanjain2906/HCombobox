import ComboBox from '../components/HComboBox/ComboBox';
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
    title:'Combobox',
    component: ComboBox,
    parameters: {
        layout: 'centered',
    },
} satisfies Meta<typeof ComboBox>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};