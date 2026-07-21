// Kayıt sırasında (email onayı bekleniyorsa) seçilen rolü geçici olarak
// cihazda saklamak için kullanılan AsyncStorage anahtar öneki.
// RegisterScreen bu anahtarla yazar, AuthContext ilk başarılı girişte okuyup uygular.
export const PENDING_ROLE_PREFIX = 'plantai:pendingRole:';
