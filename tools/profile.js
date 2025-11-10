const tool = {
    name: 'Profile',
    icon: 'user',
    render: (user) => {
        const output = `
--- User Profile ---
Name:  ${user.displayName}
Email: ${user.email}
        `;
        return {
            text: output
        };
    }
};

export { tool };
