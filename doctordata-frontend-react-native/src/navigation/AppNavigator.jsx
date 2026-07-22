import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'

import { useAuth } from '../context/AuthContext'
import LoadingScreen from '../components/LoadingScreen'
import LoginScreen           from '../screens/LoginScreen'
import RegisterScreen        from '../screens/RegisterScreen'
import VerifyCodeScreen      from '../screens/VerifyCodeScreen'
import ForgotPasswordScreen  from '../screens/ForgotPasswordScreen'
import HomeScreen            from '../screens/HomeScreen'
import PatientProfileScreen  from '../screens/PatientProfileScreen'
import MedicalProfileScreen  from '../screens/MedicalProfileScreen'
import ClinicalInfoScreen    from '../screens/ClinicalInfoScreen'
import MembersScreen         from '../screens/MembersScreen'
import PricingScreen         from '../screens/PricingScreen'

const Stack = createNativeStackNavigator()

export default function AppNavigator() {
  const { user, loading, initStep, initError, retryInit } = useAuth()

  if (loading) {
    return <LoadingScreen step={initStep} error={initError} onRetry={retryInit} />
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#16a34a' },
          headerTintColor: 'white',
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen}
              options={{ title: 'DoctorData', headerLeft: () => null }} />
            <Stack.Screen name="PatientProfile" component={PatientProfileScreen}
              options={{ title: 'Datos personales' }} />
            <Stack.Screen name="MedicalProfile" component={MedicalProfileScreen}
              options={{ title: 'Perfil médico' }} />
            <Stack.Screen name="ClinicalInfo" component={ClinicalInfoScreen}
              options={{ title: 'Información clínica' }} />
            <Stack.Screen name="Members" component={MembersScreen}
              options={{ title: 'Personas cubiertas' }} />
            <Stack.Screen name="Pricing" component={PricingScreen}
              options={{ title: 'Planes de suscripción' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen}
              options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen}
              options={{ title: 'Crear cuenta' }} />
            <Stack.Screen name="VerifyCode" component={VerifyCodeScreen}
              options={{ title: 'Verificar código' }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen}
              options={{ title: 'Recuperar contraseña' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
