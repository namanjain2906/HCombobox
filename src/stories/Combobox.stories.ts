import Combobox from "../components/HComboBox/Combobox";
import type { Meta, StoryObj } from '@storybook/react';

const meta = {
    title:'Combobox',
    component: Combobox,
    parameters: {
        layout: 'centered',
    },
} satisfies Meta<typeof Combobox>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary: Story = {};