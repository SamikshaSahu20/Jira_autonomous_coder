test('calls login API and redirects on success', async () => {
  const mockLogin = jest.fn().mockResolvedValue({ token: 'mockToken' });
  jest.spyOn(AuthContext, 'useContext').mockReturnValue({ login: mockLogin });

  renderWithProviders(<LoginPage />);
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
  fireEvent.click(screen.getByText(/login/i));

  await waitFor(() => expect(mockLogin).toHaveBeenCalledWith({ email: 'test@example.com', password: 'password123' }));
  expect(mockNavigate).toHaveBeenCalledWith('/');
});